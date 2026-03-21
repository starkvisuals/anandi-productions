# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Dashboard, Projects, Calendar, and Team pages with Netflix/Apple TV aesthetic and Frame.io-like speed and usability.

**Architecture:** All changes are within the existing `components/MainApp.js` monolith (inner components: `Dashboard`, `ProjectsList`, `CalendarView`, `TeamManagement`) and `app/globals.css`. No new files, no new dependencies. All styling via inline styles (existing codebase pattern) + CSS utility classes.

**Tech Stack:** Next.js 14, React 18, inline styles, CSS keyframes in globals.css

**Design Doc:** `docs/plans/2026-03-22-ui-redesign-design.md`

---

### Task 1: Dashboard — Command Strip + Pulse Bar

**Files:**
- Modify: `components/MainApp.js` — the `Dashboard` component (starts at line ~2469)

**Context:** The Dashboard component is defined as an inner function `const Dashboard = () => {` inside the main `MainApp` component. It has access to all parent scope variables: `projects`, `coreTeam`, `freelancers`, `clients`, `userProfile`, `isProducer`, `isClientView`, `isMobile`, `t` (theme colors), `Icons` (SVG icon functions), and helper functions like `setView`, `setSelectedProjectId`, `showToast`, `formatDate`, `formatTimeAgo`.

**What to change:**

Replace the current welcome hero section (lines ~2560-2569) and stats grid (lines ~2571-2587) with:

**1. Command Strip** — compact single-line greeting + clickable alert pills:
- Left: `{greeting}, {userProfile?.firstName}` as h1 (24px bold) + date as small muted text on same line
- Below: horizontal row of alert pills. Each pill shows a count + label, colored by type:
  - Overdue (red `#ef4444` bg `rgba(239,68,68,0.1)`) — only shows if count > 0
  - Pending Review (purple `#a855f7` bg `rgba(168,85,247,0.1)`) — only shows if count > 0
  - New Comments (blue `#3b82f6` bg `rgba(59,130,246,0.1)`) — count from unread feedback across all projects
  - Changes Requested (orange `#f97316` bg `rgba(249,115,22,0.1)`) — only shows if count > 0
- Each pill: `onClick` navigates to relevant view (e.g., tasks view filtered by status)
- Pills are `display: inline-flex`, `padding: 6px 14px`, `borderRadius: 20px`, `fontSize: 12px`, `fontWeight: 500`, `cursor: pointer`, `gap: 6px`, `alignItems: center`
- If no alerts: show a single green pill "All clear" with check icon

**2. Pulse Bar** — inline metrics replacing the 6 stat cards:
- Single `div` with `display: flex`, `alignItems: baseline`, `gap: 24px`, `padding: 20px 0`, `borderBottom: 1px solid ${t.border}`
- Each metric: large number (26px, bold, colored) + small label below (10px, muted, uppercase)
- Metrics: Active Projects (indigo), Due This Week (amber), Overdue (red, only glows if >0), Pending Review (purple), In Progress (green), Completed (gray)
- Below metrics: thin progress bar (3px height) showing overall portfolio completion (approved assets / total assets)
- Progress bar: `background: ${t.border}`, fill: `linear-gradient(90deg, #6366f1, #a855f7)`, `borderRadius: 2px`

**Remove:** The old `statsData` array rendering with glass cards, the old `stagger-children` grid, and the duplicate `stats` array (lines ~2488-2494 — this is dead code, `statsData` at line ~2511 replaced it).

**Step 1:** Rewrite the Dashboard return JSX from the opening `<div>` through the stats section. Keep all the data computation code (lines 2469-2534) intact — only change the JSX return starting at line 2560.

**Step 2:** Run `npx next build` to verify no syntax errors.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(dashboard): replace hero + stat cards with command strip and pulse bar"
```

---

### Task 2: Dashboard — Netflix Project Row

**Files:**
- Modify: `components/MainApp.js` — Dashboard component, the "Recent Projects" section
- Modify: `app/globals.css` — add horizontal scroll utilities

**Context:** Currently the Recent Projects section (inside the two-column layout, left column) renders a vertical list of project rows in a glass card. We're replacing this with a full-width horizontal scrolling row of cinematic project cards, ABOVE the two-column layout.

**What to change:**

**1. Add CSS to globals.css:**
```css
.netflix-row {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}
.netflix-row::-webkit-scrollbar {
  height: 4px;
}
.netflix-row::-webkit-scrollbar-track {
  background: transparent;
}
.netflix-row::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
}
.netflix-row > * {
  scroll-snap-align: start;
  flex-shrink: 0;
}
```

**2. Replace the Recent Projects card** with a full-width section placed BEFORE the two-column layout:

- Section header: "Recent Projects" (14px, fontWeight 600) + "(count)" muted + "View All →" link on right
- Below: a `div.netflix-row` containing project cards
- Each card: `width: 200px` (mobile: `160px`), `borderRadius: 12px`, `overflow: hidden`, `background: t.bgCard`, `border: 1px solid ${t.border}`, `cursor: pointer`, `transition: all 0.2s`
- Card top (60%): thumbnail area — if project has a first image asset with `thumbnailUrl`, use it as `background: url(...) center/cover`. Otherwise use the `typeGradients` gradient. Height: `140px` (mobile: `110px`)
- Overlay on thumbnail: status dot (top-right corner, 8px circle with status color), notification count badge if any (top-left)
- Card bottom (40%): `padding: 12px`
  - Project name: 13px, fontWeight 600, single line truncated
  - Client: 11px, muted, single line truncated
  - Thin progress bar: 3px height, same gradient as pulse bar
  - `{progressPct}%` text: 10px muted, right-aligned
- Hover: `transform: scale(1.03)`, `borderColor: rgba(99,102,241,0.4)`, `boxShadow: 0 8px 24px rgba(0,0,0,0.4)`
- onClick: `setSelectedProjectId(p.id); setView('projects');`

**3. Update the two-column layout:**
- Left column: now contains only the "Needs Attention" panel (move it here, expand it — see Task 3)
- Right column: Activity Feed (keep) + Team Workload (keep)

**Step 1:** Add CSS classes to `globals.css`.

**Step 2:** Rewrite the project section in Dashboard JSX.

**Step 3:** Run `npx next build` to verify.

**Step 4:** Commit:
```bash
git add components/MainApp.js app/globals.css
git commit -m "feat(dashboard): add Netflix-style horizontal project scroll row"
```

---

### Task 3: Dashboard — Needs Attention Panel + Activity Feed Cleanup

**Files:**
- Modify: `components/MainApp.js` — Dashboard component, two-column section

**Context:** The current left column has Recent Projects (now moved to Netflix row above) and an Alerts section. The right column has Activity Feed and Team Workload.

**What to change:**

**Left column — "Needs Attention" panel (expanded):**
- Header: "Needs Attention" with alert icon, 14px bold
- Aggregates ALL actionable items into a single sorted list:
  1. Overdue assets — red left border (`borderLeft: 3px solid #ef4444`)
  2. Assets with changes requested — orange left border (`borderLeft: 3px solid #f97316`)
  3. Pending review assets — purple left border (`borderLeft: 3px solid #a855f7`)
  4. Unread client comments/feedback — blue left border (`borderLeft: 3px solid #3b82f6`)
- Each item row: `padding: 10px 14px`, `background: t.bgCard`, `borderRadius: 8px`, `marginBottom: 6px`, `cursor: pointer`
  - Line 1: asset name (13px, bold) + time ago (11px, muted, right-aligned)
  - Line 2: project name (11px, muted) + type label ("overdue" / "needs review" / "changes requested")
- onClick: navigate to that asset's project
- Sorted by urgency: overdue first (sorted by how late), then changes requested, then reviews, then comments
- If empty: show a centered "All clear" state with green check icon and "Nothing needs your attention" text
- `maxHeight: 400px`, `overflowY: auto`

**Right column — Activity Feed cleanup:**
- Remove the glass card wrapper — just a section with header and rows
- Keep the timeline dot + line visual
- Keep the grouped layout (Today / Yesterday / Earlier)
- Use `formatTimeAgo` for relative timestamps
- Keep Team Workload section below (no changes needed)

**Step 1:** Rewrite the two-column section JSX in Dashboard.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(dashboard): add needs-attention panel and clean up activity feed"
```

---

### Task 4: Dashboard — Quick Action Shortcuts + Final Polish

**Files:**
- Modify: `components/MainApp.js` — Dashboard component

**What to change:**

**1. Replace quick action pill buttons** with keyboard shortcut hints:
- Place at the very bottom of the dashboard, after the two-column layout
- Style: `display: flex`, `gap: 20px`, `justifyContent: center`, `padding: 16px 0`, `borderTop: 1px solid ${t.border}`
- Each hint: `fontSize: 11px`, `color: t.textMuted`
  - `N` → New Project (only if isProducer)
  - `U` → Upload (only if isProducer)
  - `T` → Add Team (only if isProducer)
  - `⌘K` → Search (always)
- The key letter: `display: inline-flex`, `width: 20px`, `height: 20px`, `alignItems: center`, `justifyContent: center`, `background: t.bgCard`, `border: 1px solid ${t.border}`, `borderRadius: 4px`, `fontSize: 10px`, `fontWeight: 600`, `marginRight: 6px`

**2. Remove all emojis** from Dashboard — the old `stats` array (if still present) uses emoji icons. Make sure only `Icons.*` SVG functions are used.

**3. Remove the old `showCompleted` state and completed projects accordion** from Dashboard — that's a Projects page concern.

**Step 1:** Add shortcut hints, remove emojis, clean up.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(dashboard): add keyboard shortcut hints, remove emojis"
```

---

### Task 5: Projects Page — Underline Tabs + Clean Filter Bar

**Files:**
- Modify: `components/MainApp.js` — the `ProjectsList` component (starts at line ~4334)

**Context:** ProjectsList is also an inner function with access to all parent scope. It currently has pill-style Active/Completed tabs with emojis (📂 ✅), a search input, and a "+ New" button.

**What to change:**

**1. Replace the header + tabs** with a clean filter bar:
- Top row: "Projects" h1 (24px bold, no emoji) on left, "+ New Project" gradient button on right
- Below: underline-style tabs in a row:
  - `All ({total})` | `Active ({count})` | `Completed ({count})`
  - Active tab: `color: #fff`, `borderBottom: 2px solid #6366f1`, `fontWeight: 600`
  - Inactive tab: `color: t.textMuted`, `borderBottom: 2px solid transparent`, `fontWeight: 400`
  - Tab container: `display: flex`, `gap: 24px`, `borderBottom: 1px solid ${t.border}`, `marginBottom: 20px`
  - Each tab: `padding: 10px 0`, `fontSize: 13px`, `cursor: pointer`, `background: none`, `border: none` (except bottom border)
- Search: right-aligned in the tab row, `width: 200px`, with SVG search icon
- Add "All" tab to `projectTab` state — when selected, shows both active and completed

**2. Remove emojis** from tab labels (📂 ✅) — text only with count badges

**Step 1:** Rewrite the header and tabs section of ProjectsList.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(projects): replace pill tabs with underline tabs, remove emojis"
```

---

### Task 6: Projects Page — Compact Card Grid

**Files:**
- Modify: `components/MainApp.js` — ProjectsList component, the card grid

**What to change:**

**1. Reduce card height** — currently cards are ~280px with a tall 120px gradient area:
- Card total height: ~200px
- Thumbnail area: `height: 90px` (was 120px)
- Content area: streamlined padding

**2. Remove emojis from cards:**
- Replace `typeIcons` emoji map with type initial letters or just use the gradient background
- If no thumbnail: show a clean gradient (existing `typeGradients` are fine) with a centered type label in small muted text (e.g., "PHOTOSHOOT" in 9px uppercase)
- No big emoji in the center of the gradient

**3. Clean up producer action buttons** on card hover:
- Remove emoji from "Complete" button — use `Icons.check` instead
- Remove emoji from delete button — use `Icons.trash` instead

**4. Status badge** — replace the `<Badge>` component overlay with a small colored dot (8px) + status text:
- Position: top-right of thumbnail area
- Style: `display: flex`, `gap: 4px`, `alignItems: center`, `padding: 4px 10px`, `background: rgba(0,0,0,0.6)`, `backdropFilter: blur(8px)`, `borderRadius: 12px`, `fontSize: 10px`

**Step 1:** Update the card rendering in the grid map function.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(projects): compact cards, remove emojis, cleaner status badges"
```

---

### Task 7: Calendar Page — Clean Header + Cinematic Grid

**Files:**
- Modify: `components/MainApp.js` — the `CalendarView` component (starts at line ~1746)

**What to change:**

**1. Header cleanup:**
- Replace `📅 Calendar` with plain "Calendar" (24px bold)
- Month navigation stays but cleaner: remove the card wrapper around nav buttons
- Style nav buttons as minimal: `background: transparent`, `border: 1px solid ${t.border}`, `borderRadius: 8px`, `padding: 8px 12px`, `cursor: pointer`
- "Today" button: subtle pill, `background: t.bgCard`, `border: 1px solid ${t.border}`, not the loud gradient primary button

**2. Calendar grid:**
- Day cells background: darker `#0c0c14` instead of `t.bgTertiary`
- Grid gap: `1px` (tight, like a proper calendar)
- Cell min-height: `110px`
- Today indicator: indigo left border (`borderLeft: 3px solid #6366f1`) instead of background fill
- Day number: clean, `fontSize: 13px`, `fontWeight: 500`
- Past days: `opacity: 0.5` (more dimmed)

**3. Event bars in cells:**
- Keep the colored left-border style for events (it's already close to what we want)
- Clean up: remove the color dots row at the bottom of cells (redundant with the event bars)
- Event text: `fontSize: 11px` (was 10px)

**4. Start week on Monday:**
- Change day headers from `['Sun', 'Mon', ...]` to `['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']`
- Adjust `startPad` calculation: `const startPad = (firstDay.getDay() + 6) % 7;` (Monday = 0)

**Step 1:** Rewrite CalendarView header and grid.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(calendar): clean header, cinematic grid, Monday start"
```

---

### Task 8: Team Page — List Rows + Underline Tabs

**Files:**
- Modify: `components/MainApp.js` — the `TeamManagement` component (starts at line ~4535)

**What to change:**

**1. Header:**
- Replace `👥 Team` with plain "Team" (24px bold)
- Keep subtitle with member counts
- Keep "+ Add Member" gradient button

**2. Replace pill tabs** with underline tabs (same pattern as Projects):
- Tabs: `All ({total})` | `Core Team ({count})` | `Freelancers ({count})` | `Clients ({count})`
- Add "All" option to `tab` state
- Same underline style: active = indigo bottom border, inactive = transparent

**3. Make search functional:**
- Replace the fake search display with a real `<input>`:
  - Add `const [teamSearch, setTeamSearch] = useState('');` state
  - Filter displayed members by name or email matching search
  - Style: `width: 100%`, `padding: 10px 14px 10px 36px`, `background: t.bgCard`, `border: 1px solid ${t.border}`, `borderRadius: 10px`, `color: t.text`, `fontSize: 13px`
  - SVG search icon positioned absolute left

**4. Replace card grid with list rows:**
- Replace the `renderUser` function to return a list row instead of a card:
- Each row: `display: flex`, `alignItems: center`, `padding: 14px 16px`, `background: t.bgCard`, `borderRadius: 10px`, `marginBottom: 6px`, `border: 1px solid ${t.border}`, `cursor: pointer`, `transition: all 0.2s`
- Row layout:
  - Avatar (36px) — left
  - Name + email column: name (14px, fontWeight 600), email below (11px, muted) — flex: 1
  - Role badge: existing `<RoleBadge>` component — center
  - Workload stats: "{activeAssets.length} active" + red dot if overdue — right
  - Hover: `background: t.bgTertiary`
- Remove the old card layout with centered avatar, stats row divider, projects section, action buttons
- Keep project info accessible: on hover, show quick action icon buttons (view projects) at far right

**5. Remove all emojis** from tabs, search, and buttons.

**Step 1:** Rewrite TeamManagement with list rows and underline tabs.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js
git commit -m "feat(team): list rows, underline tabs, working search, remove emojis"
```

---

### Task 9: Global Cleanup — Remove Remaining Emojis + Consistency Pass

**Files:**
- Modify: `components/MainApp.js` — scan entire file for remaining emojis in page headers, buttons, labels
- Modify: `app/globals.css` — any new utility classes needed

**What to change:**

**1. Scan for emojis** in all other views and shared components:
- KanbanView columns use emojis (⏳ ⚡ 👁️ 🔄 ✓) — replace with SVG icons or colored dots
- Downloads view, Tasks view headers — remove emojis
- Sidebar navigation items — ensure SVG icons only (should already be done from previous overhaul)
- Modal titles — remove any emoji prefixes

**2. Ensure consistent hover/transition** patterns:
- All clickable cards/rows: `transition: all 0.2s ease`
- Hover: subtle background change or border glow, no dramatic transforms
- Remove `hover-lift` class from items where `scale(1.05)` is too aggressive — use `scale(1.01)` max

**3. Verify the build:**
- Run `npx next build` — must compile successfully
- Check for any orphaned references to removed code

**Step 1:** Search and replace emojis, consistency cleanup.

**Step 2:** Run `npx next build` to verify.

**Step 3:** Commit:
```bash
git add components/MainApp.js app/globals.css
git commit -m "chore: remove remaining emojis, consistency pass across all views"
```

---

### Task 10: Final Build + Push

**Files:**
- All modified files

**Step 1:** Run full build:
```bash
npx next build
```
Expected: `✓ Compiled successfully`

**Step 2:** Push to GitHub:
```bash
git push origin main
```

**Step 3:** Verify Vercel deployment succeeds (state: READY).

---

## Task Dependency Order

```
Task 1 (Command Strip + Pulse Bar)
  → Task 2 (Netflix Row)
    → Task 3 (Needs Attention + Activity)
      → Task 4 (Shortcuts + Polish)
        → Task 5 (Projects Tabs)
          → Task 6 (Projects Cards)
            → Task 7 (Calendar)
              → Task 8 (Team)
                → Task 9 (Global Cleanup)
                  → Task 10 (Build + Push)
```

All tasks are sequential since they modify the same file (`MainApp.js`) and could conflict if parallelized.
