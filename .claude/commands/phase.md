---
description: Run a phase from docs/PLAN.md (usage: /phase 1)
argument-hint: <phase number>
---
Read @docs/PLAN.md and @docs/SPEC.md. Run **Phase $ARGUMENTS** only.

1. Restate the acceptance criteria for this phase.
2. Propose a short plan (files to create or change), then implement it.
3. Follow every rule in CLAUDE.md (tokens only, a11y, secrets server-side).
4. Run `npm run lint`, `npm run typecheck` and `npm run build`, and fix any failures.
5. Finish with: what changed, how to check it manually, and anything I (the human) must do, such as Figma or Deployxa steps.
