# Kickoff prompt for Claude Code

Paste this as your first message in `claude` (in plan mode: Shift+Tab):

---
You're building **Drift Detector** for a hackathon due Oct 19, 2026. Read @CLAUDE.md, @docs/SPEC.md and @docs/PLAN.md.

1. Summarise the product, the MVP scope, and how Deployxa is integrated, in 8 bullets max.
2. List anything in the spec that's ambiguous or risky for a 9-day build, and propose a default for each.
3. Check the scaffold (`package.json`, `src/app`) and list the packages each phase will need. Don't install yet.
4. Wait for my go-ahead, then run Phase 1 with `/phase 1`.
---

Each day after that: `/phase <n>`, review the diff, commit, push. Deployxa builds a preview for every pull request.
