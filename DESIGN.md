# DESIGN.md: SocietyCare

> **Status: DIRECTION APPROVED — "Quiet Estate" (2026-11-24).**
> Universal rules (anti-slop, motion, QA) live in the global `design-expert` skill. This file holds only
> what is specific to SocietyCare.

## Project facts (from the code, not invented)
- Purpose / audience: residential society (apartment complex) operations. Residents raise and track
  maintenance complaints, read notices, join events and the community chat. Society admins triage
  complaints, publish notices, manage assets (with QR labels for equipment reporting) and residents.
- Framework & styling: React 19 + Vite 6, plain CSS files per page plus shared layers in `client/src/styles`.
- Animation library: `framer-motion` (kept; `MotionConfig reducedMotion="user"` at the root).
- Assets worth preserving: the interactive isometric courtyard model (`Courtyard.jsx`), self-hosted Geist,
  Geist Mono and Inter WOFF2 files, the brand mark in `Workspace.jsx`.

## 1. Visual atmosphere
Calm, residential, well-kept. Like a good building lobby: warm paper, quiet ink, one evergreen accent.
Information is ruled, not boxed; surfaces appear only where content is grouped.

## 2. Brand personality
Trustworthy caretaker. Plain, specific sentences. No hype, no fake numbers.

## 3. Color palette & semantic roles
Light is the default theme; graphite dark is a full peer (`data-theme="dark"`).

| Token | Role | Light | Dark |
|---|---|---|---|
| `--color-bg-base` | page canvas | `#F6F4EF` | `#121412` |
| `--color-bg-surface` | grouped content | `#FDFCF9` | `#191C1A` |
| `--color-bg-elevated` | wells, inputs on surface, hover | `#EFECE4` | `#212522` |
| `--color-gray-900` | ink | `#17191C` | `#F3F4EF` |
| `--color-gray-500` | muted ink | `#5B605C` | `#A6ACA3` |
| `--color-gray-200` | hairline | `#E3DFD5` | `#2B2F2C` |
| `--color-accent` | evergreen, used sparingly | `#1F5F4A` | `#86C8A9` |
| `--color-status-open` | awaiting work (slate blue) | `#2F5788` | `#A9C0E2` |
| `--color-warning` | in progress | `#875710` | `#E3B96B` |
| `--color-success` | resolved | `#2C6A3C` | `#9DCB91` |
| `--color-danger` | destructive / high priority | `#A3372F` | `#EF9C91` |

## 4. Typography
- Geist (variable 400–700) for display and UI text. Inter is retained only as a fallback.
- Geist Mono for identifiers: asset codes, flat numbers, QR tokens, timestamps in tables.
- All counts and dates use `font-variant-numeric: tabular-nums`.

## 5. Sizes, weights, tracking
| Role | Size | Weight | Tracking |
|---|---|---|---|
| display-xl (landing hero) | `clamp(2.6rem, 5.4vw, 4.6rem)` / 1.02 | 600 | -0.045em |
| display-md (page title) | `clamp(1.75rem, 2.6vw, 2.25rem)` / 1.1 | 600 | -0.035em |
| heading (section) | 1.0625rem / 1.3 | 600 | -0.015em |
| body | 0.9375rem / 1.6 | 400 | 0 |
| caption | 0.8125rem / 1.5 | 500 | 0 |
| overline | 0.75rem | 500 | 0.02em (sentence case, never all-caps tracking) |

## 6. Layout
App content max-width 1180px. Sidebar 248px (collapsed 68px). Landing max-width 1200px with a 12-col grid.

## 7. Spacing
4px base (`--space-*` tokens). Page padding 40px desktop, 20px mobile. Section rhythm 32–48px in-app.

## 8. Components
- Buttons: 40px tall, 8px radius, primary is solid evergreen; secondary is surface + hairline; ghost is text.
- Inputs: 42px, surface fill, 1px control border, evergreen 3px focus ring.
- Status: dot + label pill, never colour alone.
- Lists: ruled rows (hairline separators) inside one surface panel, not stacked cards.

## 9. Border radius
`--radius-xs 4px`, `--radius-sm 6px`, `--radius-md 8px`, `--radius-lg 12px` (panels), full for pills/avatars.

## 10. Shadow & elevation
Near-flat. Hairlines separate. Shadows only for floating layers (menus, dialogs, sticky mobile nav).

## 11. Icons
lucide-react, 1.75 stroke, 16px inline / 18px nav.

## 12. Image direction
No stock photos. The isometric courtyard is the brand illustration. Product previews are built from real UI
components with clearly illustrative sample text.

## 13. Motion character
Durations 160ms (state), 240ms (enter), 520ms (landing reveals). Easing `cubic-bezier(0.22, 1, 0.36, 1)`.
Landing: one hero entrance + scroll reveals per section (opacity + 12px rise, 50–70ms stagger).
App: route fade/rise 6px; hover = colour change only; press = scale(0.98). Reduced motion → no movement.

## 14. Responsive
Breakpoints 1080 / 768 / 480. Sidebar becomes a top bar with a disclosure menu below 768.

## 15. Accessibility
WCAG 2.2 AA. Text ≥ 4.5:1 (enforced by `client/tests/platform-check.cjs`), controls ≥ 3:1, visible focus.

## 16. Approved decisions
| Date | Decision | Context |
|---|---|---|
| 2026-11-24 | "Quiet Estate" direction: warm paper + evergreen, Geist, ruled lists, courtyard hero | Owner chose from three directions |

## 17. Rejected for this project
- Indigo/purple accent and blue-black dark-first look (previous theme).
- Grids of identical metric cards with icon top-right as the only dashboard idea.
- ALL-CAPS tracked eyebrow labels.
