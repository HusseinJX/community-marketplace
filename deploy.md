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

## Rollback — what was live before this deploy

Every deploy adds a CapRover **version**; the droplet keeps the last **50**, so going back
is a click, not a rebuild. Record the version + the commit here EVERY time, because
CapRover stores no git hash — the version number is meaningless without this table.

| CapRover version | Deployed | Git commit | Tag |
|---|---|---|---|
| **v140** (live) | 2026-09-23 18:20 UTC | `299af25` | `prod-v140` |
| v139 | 2026-08-25 00:54 UTC | `0de9ddd` | `prod-v139` |
| v138 | 2026-08-23 05:51 UTC | `a036151` | `prod-v138` |
| v137 | 2026-08-23 05:39 UTC | `94b10a8` | `prod-v137` |
| v136 | 2026-08-23 01:59 UTC | `6769673` | `prod-v136` |
| v135 | 2026-08-23 00:42 UTC | `a933a8b` | `prod-v135` |
| v134 | 2026-08-23 00:29 UTC | `9cecf2a` | `prod-v134` |
| v133 | 2026-08-22 23:48 UTC | `5a740c7` | `prod-v133` |
| v132 | 2026-08-22 21:26 UTC | `3798f58` | `prod-v132` |
| v131 | 2026-08-13 22:00 UTC | `1aa1452` | `prod-v131` |

**To go back one deploy (v140 → v139):**

- **Fast** — CapRover dashboard → `marketplace` → Deployment → pick v139 → revert. The
  image is already on the droplet; no build, no upload.
- **Slow** (if the image is gone) — `git checkout prod-v139 && npm run build`, then the
  normal package + upload below.

**⚠️ A rollback does not undo the database.** v140 added `shopper_lists`
(`20260923120000`) and v139→v140 carries the memberships pair (`20260825120000`,
`20260825130000`). All three are additive — new tables and columns — so every
version back to v131 still runs against them. What a rollback to v139 DOES lose
is the only home shopper lists have: pre-v140 code reads localStorage, so lists
already merged into an account go quiet until v140 is back. They are not
deleted; the rows sit there unread.

Migrations applied on 2026-08-22 —
`20260822170000` pickup_arrangement, `20260822190000` pickup_verified, `20260822210000`
product_images, `20260822220000` support_chat — are all additive (new columns and tables),
so v132 and v131 both run fine against them (v133–v139 add no migration). Two data changes also survive a rollback: 153 of Xeno's
Printify product rows were set `active = false` (the non-xen0 designs), and any profile
photos edited through the new editor.

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
