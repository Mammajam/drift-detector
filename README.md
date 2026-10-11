# Drift Detector

Catch the gap between design and build before users do. Drift Detector overlays Figma frames on every Deployxa preview build, flags spacing, type and colour drift, and turns each one into a fix ticket.

Hyperbloom October 2026, UI/UX & Web Design. Sponsor integration: Deployxa.

## Start here (Claude Code)
1. `npm install`
2. `git init && git add -A && git commit -m "chore: scaffold"`
3. `cp .env.example .env.local` and add your `FIGMA_TOKEN`
4. Run `claude` in this folder and approve the `figma` MCP server (then `/mcp` to sign in)
5. Paste the kickoff prompt from `docs/KICKOFF.md`, then run `/phase 1`, `/phase 2`, …

## Project map
| Path | Purpose |
|---|---|
| `CLAUDE.md` | Rules and context Claude Code loads every session |
| `docs/SPEC.md` | Product spec (from the case study) |
| `docs/PLAN.md` | Phased 9-day build plan with prompts |
| `docs/case-study.html` | The case study page (open it in a browser) |
| `.claude/commands/phase.md` | `/phase <n>` slash command |
| `.claude/agents/a11y-reviewer.md` | Accessibility review subagent |
| `.claude/settings.json` | Allowed commands; blocks reading `.env` files |
| `.mcp.json` | Figma MCP server for design-to-code |
