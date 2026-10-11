# Drift Detector

Visual QA tool: overlays Figma frames on Deployxa preview builds and turns mismatches ("drift") into tickets.
Built for the Hyperbloom October 2026 hackathon (sponsor: Deployxa). Deadline Oct 19, 2026, 22:00 GMT+1.

- Product spec: @docs/SPEC.md
- Phased build plan and prompts: @docs/PLAN.md

## Stack
- Next.js 15 (App Router, `src/`), React 19, TypeScript (strict)
- Plain CSS with design tokens (`src/app/tokens.css`) + CSS Modules. No Tailwind.
- Postgres (Deployxa managed) via Drizzle ORM; migrations in `drizzle/`
- Playwright (capture worker), pixelmatch + pngjs (diff)
- Figma REST API for frame images; Figma MCP for design-to-code during development

## Commands
- `npm run dev`: local dev server
- `npm run lint`, `npm run typecheck`: run both before you say a task is done
- `npm run build`: must pass before a phase is complete

## Rules
- Colours, spacing, radius and type come ONLY from CSS tokens in `src/app/tokens.css` (light + dark). No hex literals in components.
- Semantic colours never change meaning: design = blue, build = amber, drift = rose, resolved = green.
- Theme: Light / Dark / System through `ThemeProvider` (`src/components/theme/`). Never read `localStorage` without try/catch.
- Accessibility is a requirement: every visual pin has a text-list twin; never signal by colour alone; visible focus; respect `prefers-reduced-motion`.
- Secrets only through env vars (`FIGMA_TOKEN`, `DATABASE_URL`); never import them into client components.
- Spec values are shown as `expected → actual` in JetBrains Mono.
- Server code goes in `src/server/`; shared types in `src/lib/types.ts`.
- Keep components small. Use real sample data (in `src/lib/sample/`) until the backend is ready.
- Work one phase at a time from docs/PLAN.md. Use plan mode first, and finish with a short summary of what changed.
