# Deploying the Community Marketplace

Production runs as a **CapRover** app on a DigitalOcean droplet.
(This supersedes the previous Netlify setup.)

| | |
|---|---|
| CapRover dashboard | `https://captain.whatslocal.ai` |
| App name | `marketplace` |
| Live URLs | `https://whatslocal.ai` and `https://marketplace.whatslocal.ai` (same app) |
| Droplet | 1 vCPU / **1 GB RAM**, SFO3 |
| Container port | **3000** (Next.js standalone server) |
| Trigger | **Manual** (not git-triggered) |

> **Why it's set up this way:** the droplet has only 1 GB RAM — not enough to run
> `next build` (it OOMs). So the heavy compile runs **locally on your machine**, and
> CapRover's Docker build only *copies* the prebuilt output. No compilation happens
> on the server. See the `Dockerfile`.

---

## TL;DR — routine deploy

```bash
export CAPROVER_PASSWORD='<caprover dashboard password>'   # never commit this
./scripts/deploy-caprover.sh
```

It builds locally, packages the standalone output, uploads it to CapRover, and waits
for the (copy-only) server build. Then verify:

```bash
curl -sI https://whatslocal.ai/ | head -1     # expect: HTTP/2 200
```

---

## How it works (the moving parts)

Three files make this work:

- **`next.config.ts`** — `output: "standalone"`, so `next build` emits a
  self-contained server bundle under `.next/standalone`.
- **`Dockerfile`** — does **not** run `npm run build`. It copies the prebuilt
  `.next/standalone`, `.next/static`, and `public` into `node:22-slim` and runs
  `node server.js`. It also swaps the macOS/arm64 `sharp` binary (bundled by your
  local build) for the Linux one, installed in an **isolated** dir so the standalone
  `node_modules` is never pruned.
- **`captain-definition`** — points CapRover at `./Dockerfile`.

Deploys upload a **tarball** to the CapRover API (not a git push). We use the API
rather than the `caprover` CLI because the CLI needs a TTY and hangs in
non-interactive shells.

---

## Manual deploy (what the script does, step by step)

```bash
# 1. Build locally (uses .env.local for NEXT_PUBLIC_* values)
npm run build

# 2. Package only what the image needs
tar -czf /tmp/marketplace-deploy.tar.gz \
    captain-definition Dockerfile public .next/standalone .next/static

# 3. Authenticate
TOKEN=$(curl -s https://captain.whatslocal.ai/api/v2/login \
  -H 'x-namespace: captain' -H 'Content-Type: application/json' \
  -d "{\"password\":\"$CAPROVER_PASSWORD\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["token"])')

# 4. Upload + build (detached)
curl -s "https://captain.whatslocal.ai/api/v2/user/apps/appData/marketplace/?detached=1" \
  -H 'x-namespace: captain' -H "x-captain-auth: $TOKEN" \
  -F "sourceFile=@/tmp/marketplace-deploy.tar.gz"
```

Watch progress at `https://captain.whatslocal.ai` → Apps → `marketplace` → Deployment.

---

## One-time setup (already done — kept for rebuilding the app)

If the app ever has to be recreated:

1. **Create the app** named `marketplace` (no persistent data).
2. **Set Container HTTP Port to `3000`** (App → HTTP Settings). Without this the app
   serves the "Powered by CapRover" placeholder, then `502` — CapRover defaults to
   port 80, but our server listens on 3000.
3. **Add environment variables** (App → App Configs). The app needs the full runtime
   env (Clerk, Stripe, Supabase, WorkOS, OpenAI, PostHog, connector, …). Source of
   truth is local **`.env.local`**. Without `CLERK_SECRET_KEY` especially, every
   request 500s (`Missing secretKey`).
4. **Enable HTTPS** for the domains pointed at the app.

`NEXT_PUBLIC_*` values are baked in at **build time** from `.env.local`; all other
(server-side) vars are read at **runtime** from CapRover's env — update those in the
dashboard when they change (no rebuild needed for server-only vars).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Shows **"Powered by CapRover"** | Container port not set | Set port to **3000** |
| **502 Bad Gateway** | Container not listening / crashed | Check App → Logs |
| **500 every request**, `@clerk/nextjs: Missing secretKey` | Missing runtime env | Add env vars from `.env.local` |
| Boots then crashes, `Cannot find module 'next'` | `npm install` pruned the standalone `node_modules` | Ensure `Dockerfile` installs `sharp` in an **isolated** dir (it does) |
| `sharp` / image errors at runtime | macOS binary shipped to Linux | `Dockerfile` swaps it — rebuild |
| `caprover deploy` → `ERR_USE_AFTER_CLOSE` | CLI needs a TTY | Use the API method / deploy script |

## Notes

- **Never commit the CapRover password** — pass it via `CAPROVER_PASSWORD` only.
- `whatslocal.ai` and `marketplace.whatslocal.ai` are the same app; one deploy
  updates both.
