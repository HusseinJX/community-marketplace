#!/usr/bin/env bash
#
# Deploy the marketplace to CapRover.
#
# The heavy Next.js compile runs LOCALLY (the 1GB droplet OOMs on `next build`);
# CapRover's Docker build only copies the prebuilt standalone output.
#
# Usage:
#   export CAPROVER_PASSWORD='...'      # never commit this
#   ./scripts/deploy-caprover.sh
#
# Optional overrides: CAPROVER_URL, CAPROVER_APP
#
set -euo pipefail

APP="${CAPROVER_APP:-marketplace}"
CAPTAIN="${CAPROVER_URL:-https://captain.whatslocal.ai}"
: "${CAPROVER_PASSWORD:?Set CAPROVER_PASSWORD in your shell (do not commit it)}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Guard against the Clerk build-time key trap (fail fast, before the build):
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is inlined at build time, and .env.local holds
# pk_test for localhost. If a prod build bakes the DEV key, fresh visitors get a 500
# (dev-browser handshake). Resolve the key Next WILL bake (production precedence:
# .env.production.local > .env.local > .env.production > .env) and require pk_live.
echo "==> Verifying prod Clerk key (must be pk_live)…"
CLERK_PK=""
for f in .env.production.local .env.local .env.production .env; do
  [ -f "$f" ] || continue
  v="$(grep -E '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' "$f" | head -1 | cut -d= -f2- | tr -d '"' )"
  if [ -n "$v" ]; then CLERK_PK="$v"; break; fi
done
case "$CLERK_PK" in
  pk_live_*) echo "    OK — prod build will bake a live Clerk key." ;;
  pk_test_*) echo "!! ABORT: prod build would bake a DEV Clerk key (pk_test) — fresh visitors would 500."
             echo "   Fix: add .env.production.local with NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…"; exit 1 ;;
  "")        echo "!! ABORT: no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY found in any env file."; exit 1 ;;
  *)         echo "!! ABORT: unexpected Clerk key format: ${CLERK_PK:0:12}…"; exit 1 ;;
esac

echo "==> Building locally (npm run build)…"
npm run build

echo "==> Packaging deploy tarball…"
TAR="$(mktemp -t mkt-deploy).tar.gz"
tar -czf "$TAR" captain-definition Dockerfile public .next/standalone .next/static
echo "    $(du -sh "$TAR" | cut -f1)"

echo "==> Authenticating to CapRover ($CAPTAIN)…"
TOKEN="$(curl -s -m 20 "$CAPTAIN/api/v2/login" \
  -H 'x-namespace: captain' -H 'Content-Type: application/json' \
  -d "{\"password\":\"$CAPROVER_PASSWORD\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')"
[ -n "$TOKEN" ] || { echo "!! login failed"; rm -f "$TAR"; exit 1; }

echo "==> Uploading + building on CapRover (detached)…"
curl -s -m 180 "$CAPTAIN/api/v2/user/apps/appData/$APP/?detached=1" \
  -H 'x-namespace: captain' -H "x-captain-auth: $TOKEN" \
  -F "sourceFile=@$TAR" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("   ",d.get("status"),d.get("description"))'
rm -f "$TAR"

echo "==> Waiting for build to finish…"
# Poll with curl, not Python urllib: the dashboard is behind Cloudflare, which
# 403s urllib's user-agent (curl passes, as the upload above proves). Reuse the
# token from the login above — CapRover throttles rapid re-logins.
for _ in $(seq 1 60); do
  STATE="$(curl -s -m 20 "$CAPTAIN/api/v2/user/apps/appData/$APP" \
    -H 'x-namespace: captain' -H "x-captain-auth: $TOKEN" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin).get("data",{});print("building" if d.get("isAppBuilding") else ("failed" if d.get("isBuildFailed") else "ok"))' 2>/dev/null || echo err)"
  case "$STATE" in
    ok)      echo "   build OK"; break ;;
    failed)  echo "   !! BUILD FAILED — check the CapRover dashboard build log"; exit 1 ;;
    *)       sleep 10 ;;
  esac
done

echo "==> Done → https://whatslocal.ai  (and https://$APP.whatslocal.ai)"
