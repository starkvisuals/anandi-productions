# UI Redesign — Netflix Aesthetic + Frame.io Speed

## Design Philosophy

- **Visual**: Netflix/Apple TV — deep blacks, cinematic thumbnails, bold typography, premium feel
- **UX**: Frame.io — zero chrome, instant clicks, dense but scannable, keyboard-friendly
- **Principle**: Every pixel earns its place. If it's not helping make a decision or take action, it goes.

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `base` | `#08080f` | Page background |
| `card` | `#111119` | Card/panel background |
| `elevated` | `#1a1a24` | Hover states, raised surfaces |
| `border` | `rgba(255,255,255,0.06)` | Subtle separators |
| `primary` | `#6366f1` | Indigo accent |
| `accent` | `#a855f7` | Purple secondary |
| `text` | `#ffffff` | Primary text |
| `textMuted` | `rgba(255,255,255,0.4)` | Labels, secondary info |

## Consistent Patterns (All Pages)

- **No emojis** — SVG icons or text only everywhere
- **Underline tabs** — not pills, not gradient buttons. Thin 2px bottom border on active tab.
- **Hover**: subtle `scale(1.01)` lift + faint indigo border glow
- **Typography hierarchy**: 24px bold page titles, 14px section headings, 12-13px body, 10-11px labels
- **Spacing**: 24px between major sections, 12-16px between items

---

## 1. Dashboard — "Mission Control"

### 1.1 Command Strip (replaces greeting hero)
- Single line: greeting + date on the left
- Below: **clickable alert pills** showing counts for overdue (red), pending review (purple), new comments (blue), changes requested (orange)
- Each pill is clickable → jumps to filtered view
- Height: ~80px (was ~160px)

### 1.2 Pulse Bar (replaces 6 stat cards)
- Single horizontal row of inline metrics: `2 Active · 0 Due · 0 Overdue · 0 Review · 4 Done`
- Large bold numbers, small muted labels, no card borders
- Thin gradient progress bar below showing overall portfolio completion
- Overdue number glows red when > 0
- Height: ~60px (was ~180px)

### 1.3 Netflix Project Row (replaces text list)
- **Horizontal scrollable** row of project cards with CSS scroll-snap
- Cards: ~200px wide × ~240px tall
- Top 60%: thumbnail (first asset image) or rich type-gradient
- Bottom 40%: project name, client, thin progress bar, status dot
- Overdue/review badges overlay on thumbnail corner
- Hover: scale(1.03) + border glow
- Click: instant navigation to project

### 1.4 Two-Column Below

**Left: "Needs Attention" panel (NEW)**
- Aggregates ALL actionable items: overdue assets, pending reviews, unread client comments, changes requested
- Each item: colored left border (red=overdue, purple=review, blue=comment, orange=changes), asset name, project name, time ago
- Clickable → jumps directly to that asset
- Sorted by urgency
- If empty: green "All clear ✓" state

**Right: Activity Feed**
- Clean rows, no card wrapper
- Relative timestamps ("2h ago")
- Grouped: Today / Yesterday / Earlier
- Each row clickable → project

### 1.5 Quick Actions
- Keyboard shortcut hints at bottom: `N → New Project  U → Upload  T → Add Team  ⌘K → Search`
- Subtle muted text, always visible for power users

---

## 2. Projects Page

### 2.1 Header Bar
- Clean "Projects" title (no emoji)
- Right side: search input + "+ New Project" gradient button

### 2.2 Filter Tabs
- Underline-style tabs: `All (6)  Active (2)  Completed (4)`
- Active tab has 2px indigo bottom border
- Search integrated into the same row

### 2.3 Project Grid
- Responsive grid: 3-4 columns desktop, 1-2 mobile
- Cards: ~200px height — thumbnail area ~100px, content ~100px
- No emojis — use first asset thumbnail or clean gradient with type initial
- Content: name, client, progress bar, status dot + text
- Bottom row: team avatar stack (left), deadline + asset count (right)
- Hover: scale(1.02) lift + border glow

---

## 3. Calendar Page

### 3.1 Header
- Clean "Calendar" text (no 📅 emoji)
- Month navigation: `◀ March 2026 ▶` with Today pill button
- Month/Week toggle (underline tabs)

### 3.2 Calendar Grid
- Day cells: dark background (#0c0c14), subtle border, generous padding
- Today: indigo left border accent (not background fill)
- Events: colored left-border bars with single-line truncated text
- Status colors on event bars: green=approved, indigo=in-progress, amber=pending, orange=revision
- Hover on day: subtle highlight
- Drag & drop: kept with visual ghost preview
- Week starts Monday

---

## 4. Team Page

### 4.1 Header
- Clean "Team" title (no 👥 emoji)
- Subtitle: "12 members · 3 clients"
- Right: "+ Add Member" gradient button

### 4.2 Tabs + Search
- Underline tabs: `All (15)  Core Team (5)  Freelancers (7)  Clients (3)`
- Working search input below tabs

### 4.3 Team List (replaces card grid)
- **List rows**, not cards — higher information density
- Each row: avatar (left), name + email (left-center), role badge (center), workload stats (right)
- Overdue indicator: red dot when someone has overdue work
- Hover: subtle background highlight + quick action icon buttons (edit, view projects)
- Click row: inline accordion expand showing assigned projects with progress bars

---

## Implementation Scope

All changes are within `components/MainApp.js` (the Dashboard, ProjectsList, CalendarView, TeamManagement inner components) and `app/globals.css` for any new utility classes.

No new dependencies required. All styling via inline styles (existing pattern) + CSS classes in globals.css.
