# Build plan (Claude Code)

Run each phase in plan mode first (Shift+Tab), approve the plan, then let Claude Code build.
Shortcut: `/phase <n>` runs the phase prompt below.

## Phase 0 — Setup (you, ~15 min)
1. `npm install`
2. `git init && git add -A && git commit -m "chore: scaffold"` and push to a new GitHub repo.
3. `cp .env.example .env.local` and add `FIGMA_TOKEN` (Figma → Settings → Personal access tokens).
4. Start `claude` in this folder. Approve the project MCP server `figma` from `.mcp.json` when asked, and sign in with `/mcp`.
5. In Figma, finish the 4 MVP screens with Light/Dark variable modes (Days 1–2).

## Phase 1 — Tokens + theme (Day 3)
Using the Figma MCP, pull the colour, type, spacing and radius variables (Light and Dark modes) from the Drift Detector Figma file into `src/app/tokens.css`, following SPEC §8–9. Load Bricolage Grotesque, Figtree and JetBrains Mono with `next/font`. Build `ThemeProvider` + `useTheme` (light/dark/system, `localStorage` key `dd-theme` in try/catch), a no-flash inline script in the root layout `<head>`, and a `ThemeSwitch` segmented control in an app header. Replace the starter page with an app shell. Acceptance: no flash on reload in any state; switching updates every token; lint, typecheck and build pass.

## Phase 2 — Overlay inspector (Days 4–5)
Build the Overlay inspector from the Figma frame (SPEC §5.2): opacity slider (Figma ↔ Live build), Overlay / Difference / Side-by-side modes, numbered drift pins and a keyboard-accessible pin list that stays in sync (selecting one highlights the other). Use sample images and sample drifts from `src/lib/sample/`. Acceptance: fully keyboard operable; works at 375px; both themes pass AA.

## Phase 3 — Capture + diff engine (Days 5–6)
Add `src/server/capture.ts` and `POST /api/captures`: given `{ previewUrl, route, figmaFileKey, figmaNodeId }`, screenshot with Playwright at 375/768/1440 widths in light AND dark `colorScheme`; export the matching Figma frame via the Figma REST images API (`FIGMA_TOKEN`); diff with pixelmatch; cluster changed pixels into bounding boxes → drift pins. Write tests with fixture PNGs first. Acceptance: tests pass; one capture produces pins that the inspector renders.

## Phase 4 — Data + Deployxa (Days 6–7)
Add Drizzle with the schema in SPEC §7, migrations, and `DATABASE_URL` from env. Persist captures and drifts; add `GET /api/health`. Then (you) in Deployxa: connect the GitHub repo, attach managed Postgres, add `FIGMA_TOKEN` + `DATABASE_URL` as encrypted env vars, and turn on pull request preview deploys. Check that a pull request gets a preview URL. If Chromium won't run there, split the capture worker into its own container (SPEC §12).

## Phase 5 — Tickets, sign-off, polish (Day 8)
Build Project board, Drift ticket and Sign-off report (SPEC §5), with empty, loading and error states. Add a "Roll back on Deployxa" link on the report. Then run the `a11y-reviewer` subagent over every screen in both themes and fix every issue below WCAG AA.

## Phase 6 — Ship (Day 9)
Merge to main → Deployxa production. Demo script: open a pull request that changes a padding → preview gets flagged → fix → re-check → sign off. Submit the live URL + case study to Devpost.
