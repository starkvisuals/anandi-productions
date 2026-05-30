# Anandi Productions — Design System (MASTER)

> Generated using `ui-ux-pro-max` skill, then tuned to the actual brand.
> Source of truth for visual + interaction decisions across the Hub.
> When a page needs to deviate, document the override in `docs/design-system/pages/<page>.md`.

---

## 1. Brand identity

- **Industry:** Media production / creative studio
- **Audience:** Internal team (producers, editors, shooters, social, accounts), B2B clients
- **Voice:** Confident, cinematic, no-fluff, premium
- **Logo:** Bold black "AP" wordmark with a **yellow play-triangle** accent (motion / video metaphor)

The logo is the *only* place all three brand colors appear together. Elsewhere, surfaces should feel calm and editorial; **yellow is an accent, not wallpaper.**

---

## 2. Color tokens (semantic, NOT raw hex in components)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#FAFAFA` | `#0A0A0A` | App background |
| `--surface` | `#FFFFFF` | `#141414` | Cards, modals |
| `--surface-elev` | `#F4F4F5` | `#1C1C1C` | Inputs, hovers |
| `--border` | `#E5E5E5` | `#2A2A2A` | Dividers, inputs |
| `--text` | `#0A0A0A` | `#FAFAFA` | Body, headings |
| `--text-muted` | `#525252` | `#A3A3A3` | Secondary text |
| `--primary` | `#0A0A0A` | `#FAFAFA` | Primary buttons (BLACK on light, near-white on dark) |
| `--on-primary` | `#FAFAFA` | `#0A0A0A` | Text on primary buttons |
| `--accent` | `#FACC15` | `#FACC15` | **Brand yellow** — highlights, active state, focus ring, badges |
| `--on-accent` | `#0A0A0A` | `#0A0A0A` | Text on yellow (always black for contrast) |
| `--success` | `#15803D` | `#22C55E` | Confirmed, completed |
| `--warning` | `#D97706` | `#F59E0B` | Pending, attention |
| `--danger` | `#DC2626` | `#EF4444` | Destructive, errors |
| `--ring` | `#FACC15` | `#FACC15` | Focus rings (always yellow — brand expression + 3:1+ contrast) |

**Brand yellow** (`#FACC15`): vibrant, warm, matches the logo triangle. Used sparingly — active nav indicator, primary CTA hover ring, badge dots, focus state, the "play" metaphor across the app.

**Why black is primary (not yellow):** primary buttons need text on top. White-on-yellow fails WCAG. Black-on-yellow works (10.4:1). So *yellow becomes the accent layer*, not the button fill. Buttons are confident black-on-light / white-on-dark; yellow appears as the brand spark.

**Anti-patterns:**
- ❌ Yellow as a background fill behind text
- ❌ Indigo/purple gradients (off-brand)
- ❌ Mixing >2 accent colors on a single screen
- ❌ Raw hex in components — always use a token

---

## 3. Typography

- **UI (default):** **Inter** — 400 / 500 / 600 / 700 / 800
- **Editorial accents:** **Playfair Display Italic** for hero/empty-state headlines (sparingly — feels like end credits)
- **Mono / numerics:** **JetBrains Mono** for IDs, amounts, code

**Scale (px):** `12 · 14 · 16 · 18 · 24 · 32 · 48 · 64` — base 16px body, 1.5 line-height.
**Weights:** body 400, labels 500, buttons 600, headings 700/800.
**Numerics:** use `font-variant-numeric: tabular-nums` for tables, prices, IDs.

---

## 4. Spacing & radius

- **Spacing rhythm:** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (no in-between values)
- **Radius:** `4` (chips), `8` (inputs/buttons), `12` (cards), `16` (modals)
- **Section spacing:** 16/24/32/48 tiers per hierarchy depth
- **Container:** `max-w-7xl` (1280px) on desktop, edge-to-edge ≤640px

---

## 5. Motion

- **Duration:** 150–250ms micro-interactions, 250–400ms screen/page transitions, **never >500ms**
- **Easing:** `cubic-bezier(0.2, 0, 0, 1)` (Material standard out) — fast start, smooth landing
- **Properties only:** `transform`, `opacity` — never width/height/top/left (causes CLS)
- **Always:** respect `prefers-reduced-motion`
- **Exit < Enter** (~60% of enter duration)
- **Press feedback:** scale `0.97` + opacity `0.92`, 100ms

---

## 6. Components (apply these patterns)

- **Buttons:** primary = solid black/white, secondary = outline `border-text`, tertiary = text-only. Min 40×40, 16px horizontal padding, 8px gap to icon. Pressed scale 0.97.
- **Inputs:** 40px height, `border-border`, focus = `ring-2 ring-accent`. Label *above*, helper *below* (never placeholder-as-label).
- **Cards:** `surface` bg, `radius-12`, 1px border, no shadow at rest. Optional `shadow-md` on hover.
- **Modals:** fixed height to avoid jump, scrim `rgba(0,0,0,0.6)`, scale-in 200ms.
- **Tabs:** underline indicator with `accent` (yellow), 2px, animated translate.
- **Loading:** **skeletons, not spinners** for content >300ms. Use neutral surface tones, never bright shapes.
- **Empty states:** illustration or icon + 1-line message + 1 action. No bare `—`.
- **Badges:** `accent` fill for "new/active", `surface-elev` outline for neutral counts.

---

## 7. Iconography

- **Lucide-react** (already common; SVG, themeable, 1.5 stroke).
- **Never emoji** for structural icons (kept only in WhatsApp message text).
- 16/20/24 sizing tokens, stroke width 1.5 in headers, 2 in buttons.

---

## 8. Accessibility floor (non-negotiable)

- Text ≥ 4.5:1 contrast (body), ≥ 3:1 (large)
- All interactive elements ≥ 44×44 touch + visible focus ring (yellow)
- Labels on every input + `aria-label` on icon buttons
- Tab order matches visual order; modal escape via Esc and a visible close
- Respect `prefers-reduced-motion`

---

## 9. Anti-patterns (specifically called out for this app)

- ❌ Indigo/purple `#6366f1 → #a855f7` gradient (the old brand)
- ❌ Modal that resizes per tab (fixed in latest commit)
- ❌ `"Loading..."` plain text — use skeleton
- ❌ Showing `—` as the empty value — use *"Add work location"* or hide the row
- ❌ Emoji as structural icons (👑 OK in copy, ❌ as nav glyph)
- ❌ Glassmorphic surfaces stacked >2 layers — kills text legibility
- ❌ Generic AI-look gradients on every card

---

## 10. References

- Inter font: https://rsms.me/inter/
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/
- Skill: `~/.claude/skills/ui-ux-pro-max/SKILL.md`
