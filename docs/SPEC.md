# Drift Detector: Product Spec

> Source: Drift Detector case study (Hyperbloom October 2026, UI/UX & Web Design, sponsor: Deployxa).
> Live case study: https://claude.ai/artifact/3H84NBTEQoToUtFzXCKKMh (private; this file is the copy Claude Code reads).

## 1. One-liner
A visual QA tool that lays the Figma frame over every **Deployxa preview build**, flags each spacing, type and colour mismatch ("drift"), and turns it into a fix ticket.

## 2. Problem
- Builds drift from designs a few pixels at a time: a padding rounded down, a font weight swapped, a colour that's close but not the token.
- Design QA is slow, subjective, and repeated on every release. Feedback arrives as screenshots in chat, not linked to a build or pull request.
- The cost is time for designers and developers, and a product that slowly stops matching its design system.

## 3. Users (proto-personas, to validate with 5 interviews)
| Role | Quote | Needs | Wants |
|---|---|---|---|
| Product designer | "I spend release week screenshotting staging and drawing red circles." | Proof of what drifted, on which build | To sign off with confidence, not by eye |
| Frontend developer | "Tell me the exact value and where. 'Feels off' isn't a ticket." | Precise spec values (px, weight, token) | Feedback tied to their pull request |

## 4. Core flow
1. **Link**: connect a Figma frame to a route (e.g. `/pricing`) in a project.
2. **Capture**: each Deployxa preview deploy is captured at matching breakpoints (375 / 768 / 1440) in light and dark.
3. **Compare**: Overlay, Difference and Side-by-side views; drift is auto-flagged as numbered pins with expected and actual values.
4. **Resolve**: pins become tickets on the pull request; the next preview re-checks them; the designer signs off.

## 5. MVP screens
1. **Project board**: routes × preview builds, with a drift-score badge on each.
2. **Overlay inspector**: opacity slider (Figma ↔ Live build), modes Overlay / Difference (`mix-blend-mode: difference`) / Side-by-side, numbered drift pins, plus a keyboard-accessible pin list that mirrors them.
3. **Drift ticket**: expected vs actual, design token, cropped evidence, link to the pull request, status (open / fixed / won't fix).
4. **Sign-off report**: shareable page showing what drifted, what was fixed, and who approved it.

Every screen needs empty, loading and error states.

## 6. Deployxa integration (sponsor)
- **Preview deploys are the input.** Each pull request preview URL is captured and diffed.
- **Managed Postgres** stores projects, routes, captures, drifts and sign-offs.
- **Encrypted environment variables**: `FIGMA_TOKEN`, `DATABASE_URL` (never sent to the client).
- **Drift-aware rollback**: the report links to Deployxa's one-click rollback to the last signed-off build.
- **The app is deployed on Deployxa itself**: Git push to main → production; pull requests → previews.
- *Assumption:* in the MVP, preview URLs are pasted in or read from the pull request. If Deployxa exposes deploy events, the capture runs automatically.

## 7. Architecture
```
Figma API (frame images, variables/modes) ─▶ Drift Detector (Next.js on Deployxa) ◀─ Deployxa preview URLs
                                              ├─ Capture worker: Playwright (widths × colorScheme)
                                              ├─ Diff: pixelmatch → cluster regions → pins
                                              └─ Postgres (Drizzle ORM)
```
Data model: `projects`, `routes` (path, figmaFileKey, figmaNodeId), `captures` (url, commitSha, theme, breakpoint, imagePath), `drifts` (captureId, label, expected, actual, bbox, status), `signoffs` (routeId, captureId, approvedBy, at).

## 8. Theme context and switching
- Three states: **Light / Dark / System** (default System, which follows `prefers-color-scheme`).
- A React `ThemeContext` holds `choice`, derives `resolved` ('light' | 'dark'), and writes `data-theme` on `<html>`; for System the attribute is removed.
- **No flash on load**: an inline script in `<head>` applies the saved theme before the first paint.
- **Saved per user**: `localStorage` key `dd-theme` (wrapped in try/catch); later also stored in the user's profile in Postgres.
- Components use **CSS tokens only** (`src/app/tokens.css`), defined on `:root` (light), under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`, and under `:root[data-theme="dark"]`.
- **Fixed meaning in both themes**: blue = design, amber = build, rose = drift, green = resolved; each tuned per theme to keep WCAG AA contrast.
- **Theme-aware drift**: each preview is captured in both light and dark (Playwright `colorScheme`) and compared to the matching Figma variable mode.

Reference ThemeProvider sketch:
```tsx
type Choice = 'light' | 'dark' | 'system';
// state: choice (from localStorage 'dd-theme', default 'system')
// resolved = choice === 'system' ? (osDark ? 'dark' : 'light') : choice
// effect: system → removeAttribute('data-theme'); else setAttribute('data-theme', choice); persist
export const useTheme = () => useContext(ThemeCtx)!;
```

## 9. Visual direction
Light, airy, editorial. Cool off-white canvas (`#F6F8FB`), white surfaces, ink `#151A26`, muted `#5B6478`, hairlines `#E2E6EE`.
Semantic colours: design `#2F5BEA`, build `#E58A1F`, drift `#D93F6E`, resolved `#1F8A5B`.
Dark: canvas `#10131B`, surface `#181C27`, ink `#EAEDF4`, design `#7C9BFF`, build `#F2A54A`, drift `#FF6F98`, resolved `#4CC28D`.
Type: Bricolage Grotesque (display), Figtree (body), JetBrains Mono (spec values). Specs always shown as `expected → actual` in mono.
Principles: calm by default; the colour code is the same on every screen; specs, not opinions.

## 10. Accessibility (WCAG 2.1 AA)
- Every visual pin has a text-list twin that works with keyboard and screen reader.
- Drift is never signalled by colour alone (number + shape + label).
- Native controls with visible focus; `prefers-reduced-motion` respected.
- AA contrast in both themes. The tool also flags *contrast drift* (a build colour that fails AA where the design passed).

## 11. Success targets
- Faster QA: time from preview deploy to sign-off, versus a manual review (usability test).
- Fewer rounds: design QA back-and-forth per feature.
- Exact feedback: share of tickets that have an expected and an actual value.

## 12. Risks and fallbacks
- If Playwright/Chromium can't run in Deployxa's Node runtime → run the capture worker as its own container service.
- If there are no deploy events → take the preview URL from the pull request or let users paste it.
- Scope: pixel diff and pins are the MVP; matching each mismatch to an exact style value is a stretch goal.

## 13. Hackathon context
Judged on: user flows, intuitive UI, accessibility, creative interaction and information architecture, originality, polish. Separate prize for Best Use of Deployxa. Deadline **Oct 19, 2026, 10:00pm GMT+1**.
