# Deploying Drift Detector on Deployxa

Phase 4 checklist. The code side is done; the dashboard steps below are yours (they involve your GitHub
account and secrets). Deployxa's exact UI wording may differ from what is written here.

> **Verified on Deployxa (Oct 11):** the project is live at `https://drift-detector-app.deployxa.online`, `/api/health`
> returns `{"status":"ok","database":"ok"}`, and Deployxa's managed PostgreSQL is injected as `DATABASE_URL`.
> Deployxa's **GitHub import** tab stored the repo URL as `https://github.com/undefined`; use the **Git URL** tab
> (`https://github.com/Mammajam/drift-detector.git`) instead. Project: 0.5 CPU, 512 MB RAM, Node 20 builder.
> Migrations run automatically on server start in production (`src/instrumentation.ts`); set `RUN_MIGRATIONS_ON_START=0` to disable.
> Preview/app hosts end in `.deployxa.online`, so `PREVIEW_HOST_SUFFIXES=.deployxa.online`.

> **Routes:** `/` is the landing page (no database needed), `/board` the project board, `/inspector` the overlay inspector,
> `/drifts/[id]` tickets and `/report/[routeId]` sign-off reports.

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
> **Editing tip:** in Deployxa's table view, saving re-sends masked placeholders for rows you didn't edit, which can overwrite
> their real values. Use **Bulk edit** and type every `NAME=value` line out in full.

Add as **encrypted** variables, for both Production and Preview environments.

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | **do not add it** | Deployxa injects it when the managed PostgreSQL is attached. A value you add yourself may override the real one and break the database. |
| `FIGMA_TOKEN` | Figma personal access token | server only; never `NEXT_PUBLIC_` |
| `PLAYWRIGHT_BROWSERS_PATH` | `0` | so the runtime finds the Chromium installed at build time |
| `PREVIEW_HOST_SUFFIXES` | `.deployxa.online` | the capture worker refuses any other host (confirm the PR preview host also ends this way) |
| `PROJECT_NAME` | optional, default `Drift Detector` | groups routes into a project |
| `DB_POOL_MAX` | optional, default `5` | lower it if the managed Postgres has a small connection cap |
| `AUTH_SECRET` | `openssl rand -base64 32` | **secret.** Signs session cookies and enables signup/login (accounts live in Postgres). Without it, production stays read-only (nobody can change statuses, sign off or run captures) |
| `SEED_DEMO_USER_EMAIL`, `SEED_DEMO_USER_PASSWORD` | optional | Creates a shared reviewer account on start so judges can skip signup. Share the credentials in your submission, not in the repo |
| `AUTH_SECRET` | long random string (`openssl rand -base64 32`) | **secret.** Signs session cookies. The name must use an **underscore**; `AUTH-SECRET` is ignored. Deployxa generates a new one on every deploy if you don't set your own, which signs everyone out. |
| `CAPTURE_API_TOKEN` | optional long random string | **secret.** Lets CI call `POST /api/captures` with `Authorization: Bearer …` |
| `SEED_DEMO_ON_START` | `1` (optional) | loads the demo project into an empty database on server start, so the board isn't empty for visitors |
| `DEPLOYXA_ROLLBACK_URL` | optional | where "Roll back on Deployxa" points; defaults to `https://deployxa.com/dashboard/deployments` |

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
  The route needs a signed-in session cookie or `Authorization: Bearer $CAPTURE_API_TOKEN`; otherwise it returns 401.
  Optional body fields: `commitSha`, `pullRequestUrl` (shown on the board and tickets).

## If Chromium won't run on Deployxa (SPEC §12)
Symptoms: `/api/captures` returns 500 and the logs show a Playwright launch error. Fix: run the capture worker as its
own container service using the official `mcr.microsoft.com/playwright` image, exposing the same
`POST /api/captures`, and keep this app for UI + data. Tell me and I'll split it out.
