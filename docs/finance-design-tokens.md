# Finance UI — zakklee blog design tokens

Finance screens reuse the same visual language as the public blog (Braun-inspired palette, Barlow typography, flat list rows). Layout is unchanged: site header only, finance sidebar, `#app-root` isolation + `#modal-root` portals.

## Mantine theme (`app/layout.tsx`)

| Token | Value |
|--------|--------|
| `primaryColor` | `braun-red` (filled accent ≈ `#C74219` / shade 5) |
| `fontFamily` | Barlow (300, 400, 500) |
| `fontSizes` | xs 11px, sm 13px, md 15px, lg 17px, xl 20px |
| `headings` | h1 48px / 300; h2 20px / 400; h3 17px / 400 |
| `defaultRadius` | `sm` → 4px |
| Custom colors | `braun-cream` (#F4F1EC page tone), `braun-red` (accent ladder) |

## Blog CSS semantics (used by finance modules)

| Role | Light | Dark (`@mixin dark`) |
|------|--------|----------------------|
| Page background | `#f4f1ec` | `#131110` |
| Primary text | `#1c1917` | `#ede9e3` |
| Secondary / dimmed | `#5e5a56` | `#8a8480` |
| Border / rules | `#ddd8d2` | `#2a2724` |
| Accent / links / dates | `#c74219` | same accent |
| Top edge stripe | `#c74219` (2px, `body::before`) | same |

## Typography (blog list / finance sections)

| Element | Size | Weight | Notes |
|---------|------|--------|--------|
| Section title | 15px | 400 | `line-height: 1.5` |
| Body / list title | 15px | 400 | |
| Summary / helper | 13px | — | `line-height: 1.6` |
| Meta label | 11px | 500 | uppercase, `letter-spacing: 0.12em` |
| Monospace date | 11px | — | accent color |

## Spacing & surfaces

| Pattern | Value |
|---------|--------|
| List row padding | 16–24px vertical |
| Column gap (blog grid) | 24px |
| Card / modal radius | 4px |
| Shadow | none on lists; markdown images only `0 2px 8px rgba(0,0,0,0.08)` on blog |
| Link hover | `color: #c74219`, `150ms ease` |
| Site content max width | 768px (blog); finance main column max 1100px (unchanged layout) |
| Header height | 64px (`SITE_APP_SHELL_HEADER_HEIGHT_PX`) |

## Bot avatar hues (`features/finance-auth/ui/bot-avatar-art.ts`)

Deterministic **shape** from `botId` hash (unchanged); **hue** from `pickAvatarHueIndex(botId)` over 12 muted swatches tuned for warm-neutral UI (`#f4f1ec` / `#131110`).

| Hue id | Light body | Dark body | Notes |
|--------|------------|-----------|--------|
| `terracotta` | `#b85c3a` | `#df8a66` | Warm clay |
| `ochre` | `#9a7332` | `#d4ad62` | Golden brown |
| `olive` | `#646b4a` | `#a8b184` | Green-gray |
| `sage` | `#4f6f5c` | `#8fae9a` | Soft green |
| `teal` | `#3a6f6c` | `#6faaa6` | Blue-green |
| `slate-blue` | `#4a6278` | `#89a3b8` | Cool gray-blue |
| `indigo` | `#4f5580` | `#9a9ec4` | Muted violet-blue |
| `plum` | `#6e4f66` | `#b892a8` | Dusty purple |
| `rose` | `#9d5c6b` | `#d48a98` | Muted rose |
| `sand` | `#7a6b5a` | `#b8a894` | Warm taupe |
| `charcoal` | `#4a4844` | `#a8a39c` | Neutral brown-gray |
| `braun-rust` | `#a8482c` | `#d97250` | Braun-family accent |

Each swatch defines `canvas` (tile background), `body` (main blob), `inner` (accent inner blob), and `innerSoft` (soft inner blob). Body vs canvas targets **≥ 3:1** contrast on both schemes.

## Components

Finance UI maps to blog patterns via `features/finance-auth/ui/finance-ui.module.css`:

- **List cards** → blog post row: bottom border, no elevation
- **Primary button** → Mantine `braun-red` filled
- **Nav** → Mantine `NavLink` with `color="braun-red"`
- **Chat markdown** → `.finance-chat-markdown` in `globals.css` (13px / 1.6)
- **Modals** → flat panel, 4px radius, border `#ddd8d2`
