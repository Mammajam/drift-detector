# Deploying Drift Detector on Deployxa

Phase 4 checklist. The code side is done; the dashboard steps below are yours (they involve your GitHub
account and secrets). Deployxa's exact UI wording may differ from what is written here.

## 1. Push the repo
```bash
git init && git add -A && git commit -m "chore: scaffold"
# create an empty GitHub repo, then:
git remote add origin <your-repo-url> && git push -u origin main
```
`.env.local` is already git-ignored; do not commit it.

## 2. Create the project in Deployxa
- Connect the GitHub repo. Framework: Next.js (Node 20+).
- **Build command** (migrates the database, installs Chromium into `node_modules`, then builds):
  ```bash
  npm ci && npm run db:migrate && PLAYWRIGHT_BROWSERS_PATH=0 npm run playwright:install && npm run build
  ```
- **Start command:** `npm run start`
- **Health check path:** `/api/health` (200 = ok, 503 = database missing or unreachable; the body never contains secrets).

## 3. Attach managed Postgres
Attach it to the project; Deployxa should provide a connection string. Use it as `DATABASE_URL` below.

## 4. Environment variables
Add as **encrypted** variables, for both Production and Preview environments.

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | connection string from managed Postgres | server only |
| `FIGMA_TOKEN` | Figma personal access token | server only; never `NEXT_PUBLIC_` |
| `PLAYWRIGHT_BROWSERS_PATH` | `0` | so the runtime finds the Chromium installed at build time |
| `PREVIEW_HOST_SUFFIXES` | e.g. `.deployxa.app` | **confirm the real preview host pattern**; the capture worker refuses any other host |
| `PROJECT_NAME` | optional, default `Drift Detector` | groups routes into a project |
| `DB_POOL_MAX` | optional, default `5` | lower it if the managed Postgres has a small connection cap |
| `ENABLE_LIVE_INSPECTOR` | leave unset | live and stored data views stay off in production until sign-in exists (Phase 5) |

## 5. Turn on pull request previews
Enable preview deploys for pull requests. Then open a small PR and confirm it gets a preview URL.
If your previews use a host other than `.deployxa.app`, update `PREVIEW_HOST_SUFFIXES`.

## 6. Verify
- `GET https://<your-app>/api/health` returns `{"status":"ok","database":"ok"}`.
- From your machine, run a capture against a preview URL:
  ```bash
  curl -X POST https://<your-app>/api/captures -H 'content-type: application/json' \
    -d '{"previewUrl":"https://<pr-preview-host>","route":"/pricing","figmaFileKey":"<key>","figmaNodeId":"12:34"}'
  ```
  The response has `"persisted": true` when the rows were stored.
  **This route has no sign-in yet.** It only loads allowlisted hosts, but it spends your Figma token and CPU, so
  don't share the URL until Phase 5 adds auth.

## If Chromium won't run on Deployxa (SPEC §12)
Symptoms: `/api/captures` returns 500 and the logs show a Playwright launch error. Fix: run the capture worker as its
own container service using the official `mcr.microsoft.com/playwright` image, exposing the same
`POST /api/captures`, and keep this app for UI + data. Tell me and I'll split it out.
