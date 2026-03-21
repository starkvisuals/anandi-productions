# Anandi Productions - Complete UI/UX Overhaul Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Anandi Productions from a functional but plain app into a cinematic, professionally branded production management platform with intro animation, polished dashboard, improved project views, and consistent design system.

**Architecture:** Phase-by-phase UI overhaul working from the outside in — start with foundation (design system, logo, animations library), then entry screens (splash, login), then main shell (sidebar, header), then core views (dashboard, projects, assets, team). Each phase builds on the previous. All changes are in the existing Next.js 14 + Tailwind stack.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3.4, CSS Animations (native keyframes), Framer Motion (to be added for page transitions), inline SVG for logo

---

## Phase 1: Foundation — Design System & Brand Assets
*Estimated: 4 tasks | Sets up everything other phases depend on*

### Task 1.1: Create SVG Logo Component

**Files:**
- Create: `components/Logo.js`

**Step 1: Create the Anandi Productions SVG logo component**

The logo should be a clean, cinematic mark — an "AP" monogram inside a film-frame/aperture shape, with the full "ANANDI PRODUCTIONS" text option. Should support:
- `size` prop (small for sidebar, large for splash)
- `variant` prop ('full' with text, 'icon' only mark, 'wordmark' text only)
- `theme` prop ('dark'/'light') for color adaptation
- `animated` prop for intro animation variant

```jsx
// components/Logo.js
'use client';
import { useState, useEffect } from 'react';

const Logo = ({ size = 40, variant = 'full', theme = 'dark', animated = false, className = '' }) => {
  const [revealed, setRevealed] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setRevealed(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  const colors = {
    dark: { primary: '#6366f1', secondary: '#a855f7', text: '#ffffff', subtle: 'rgba(255,255,255,0.7)' },
    light: { primary: '#6366f1', secondary: '#7c3aed', text: '#111827', subtle: '#6b7280' }
  };
  const c = colors[theme] || colors.dark;
  const scale = size / 40;

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 * scale }}>
      {/* AP Monogram Mark */}
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'scale(1)' : 'scale(0.8)',
        transition: animated ? 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
      }}>
        <defs>
          <linearGradient id={`logo-grad-${size}`} x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor={c.primary} />
            <stop offset="100%" stopColor={c.secondary} />
          </linearGradient>
        </defs>
        {/* Outer rounded square frame */}
        <rect x="2" y="2" width="36" height="36" rx="10" stroke={`url(#logo-grad-${size})`} strokeWidth="2.5" fill="none" />
        {/* Inner film frame notches */}
        <rect x="6" y="0" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="14" y="0" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="23" y="0" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="31" y="0" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="6" y="36" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="14" y="36" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="23" y="36" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        <rect x="31" y="36" width="3" height="4" rx="1" fill={c.primary} opacity="0.5" />
        {/* AP Letters */}
        <text x="20" y="26" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="800" fill={`url(#logo-grad-${size})`} letterSpacing="-0.5">AP</text>
      </svg>

      {/* Wordmark */}
      {(variant === 'full' || variant === 'wordmark') && (
        <div style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateX(0)' : 'translateX(-10px)',
          transition: animated ? 'all 0.5s ease 0.3s' : 'none'
        }}>
          <div style={{ fontSize: 14 * scale, fontWeight: 800, letterSpacing: '0.08em', color: c.text, lineHeight: 1.1 }}>ANANDI</div>
          <div style={{ fontSize: 7 * scale, fontWeight: 500, letterSpacing: '0.2em', color: c.subtle, textTransform: 'uppercase', marginTop: 1 }}>Productions</div>
        </div>
      )}
    </div>
  );
};

export default Logo;
```

**Step 2: Commit**
```bash
git add components/Logo.js
git commit -m "feat: add SVG Logo component with AP monogram, variants, and animation support"
```

---

### Task 1.2: Add Animation Utilities & CSS Foundation

**Files:**
- Modify: `app/globals.css` (existing, 72 lines)

**Step 1: Add animation keyframes and utility classes to globals.css**

Append the following after the existing `.spinner` animation (after line 71):

```css
/* ============= ANIMATION SYSTEM ============= */

/* Shimmer loading effect */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Fade in up */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Fade in down */
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale in */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Slide in from left */
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Slide in from right */
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Pulse glow */
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 20px 4px rgba(99, 102, 241, 0.2); }
}

/* Film grain overlay */
@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -10%); }
  30% { transform: translate(3%, -15%); }
  50% { transform: translate(-15%, 5%); }
  70% { transform: translate(5%, 15%); }
  90% { transform: translate(-10%, 10%); }
}

/* Cinematic light leak */
@keyframes lightLeak {
  0% { opacity: 0; transform: translateX(-100%) skewX(-15deg); }
  50% { opacity: 0.07; }
  100% { opacity: 0; transform: translateX(200%) skewX(-15deg); }
}

/* Intro logo reveal */
@keyframes logoReveal {
  0% { opacity: 0; transform: scale(0.8); filter: blur(10px); }
  60% { opacity: 1; transform: scale(1.05); filter: blur(0); }
  100% { opacity: 1; transform: scale(1); filter: blur(0); }
}

/* Stagger children utility */
.stagger-children > * {
  opacity: 0;
  animation: fadeInUp 0.4s ease forwards;
}
.stagger-children > *:nth-child(1) { animation-delay: 0.05s; }
.stagger-children > *:nth-child(2) { animation-delay: 0.1s; }
.stagger-children > *:nth-child(3) { animation-delay: 0.15s; }
.stagger-children > *:nth-child(4) { animation-delay: 0.2s; }
.stagger-children > *:nth-child(5) { animation-delay: 0.25s; }
.stagger-children > *:nth-child(6) { animation-delay: 0.3s; }
.stagger-children > *:nth-child(7) { animation-delay: 0.35s; }
.stagger-children > *:nth-child(8) { animation-delay: 0.4s; }

/* Utility animation classes */
.animate-fadeIn { animation: fadeIn 0.3s ease forwards; }
.animate-fadeInUp { animation: fadeInUp 0.4s ease forwards; }
.animate-fadeInDown { animation: fadeInDown 0.3s ease forwards; }
.animate-scaleIn { animation: scaleIn 0.3s ease forwards; }
.animate-slideInLeft { animation: slideInLeft 0.3s ease forwards; }
.animate-slideInRight { animation: slideInRight 0.3s ease forwards; }

/* Modal backdrop */
.modal-backdrop {
  animation: fadeIn 0.2s ease forwards;
}
.modal-content {
  animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.glass-light {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* Smooth hover lift */
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

/* Card hover glow */
.hover-glow {
  transition: box-shadow 0.3s ease;
}
.hover-glow:hover {
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3), 0 8px 24px rgba(99, 102, 241, 0.1);
}

/* Scrollbar for dark theme */
[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: #2a2a3a;
}
[data-theme="light"] ::-webkit-scrollbar-thumb {
  background: #c0c4cc;
}
[data-theme="light"] ::-webkit-scrollbar-track {
  background: #f5f7fa;
}
```

**Step 2: Commit**
```bash
git add app/globals.css
git commit -m "feat: add animation system with keyframes, utilities, glassmorphism, and hover effects"
```

---

### Task 1.3: Install Framer Motion for Page Transitions

**Files:**
- Modify: `package.json`

**Step 1: Install framer-motion**
```bash
cd /Users/harnesh/Claude_Files/anandi-productions && npm install framer-motion
```

**Step 2: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion for page transitions and animations"
```

---

### Task 1.4: Create Public Directory with Favicon

**Files:**
- Create: `public/favicon.svg`

**Step 1: Create an SVG favicon matching the AP logo**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="40" y2="40">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="36" height="36" rx="10" stroke="url(#g)" stroke-width="2.5" fill="#0a0a0f"/>
  <text x="20" y="26" text-anchor="middle" font-family="system-ui" font-size="18" font-weight="800" fill="url(#g)">AP</text>
</svg>
```

**Step 2: Update layout.js metadata to reference favicon**

In `app/layout.js`, add icon metadata.

**Step 3: Commit**
```bash
git add public/favicon.svg app/layout.js
git commit -m "feat: add AP branded favicon"
```

---

## Phase 2: Entry Experience — Splash, Login, Setup
*Estimated: 3 tasks | First thing users see*

### Task 2.1: Create Intro Splash Screen

**Files:**
- Create: `components/SplashScreen.js`
- Modify: `app/page.js` (35 lines)

**Step 1: Create cinematic splash screen component**

The splash screen shows:
1. Dark screen
2. Subtle film grain overlay
3. Logo animates in (scale + blur reveal)
4. Light leak sweeps across
5. "ANANDI PRODUCTIONS" text fades in below
6. Whole thing fades out after ~2.5s
7. Reveals the actual app

Uses the Logo component from Task 1.1 with `animated={true}`.

**Step 2: Integrate into app/page.js**

Add splash state that shows SplashScreen on first load, then reveals the app content. Use localStorage to only show on first visit per session (sessionStorage).

**Step 3: Commit**
```bash
git add components/SplashScreen.js app/page.js
git commit -m "feat: add cinematic intro splash screen with logo animation and film grain"
```

---

### Task 2.2: Redesign Login Page

**Files:**
- Modify: `components/LoginPage.js` (93 lines)

**Step 1: Redesign the login page**

Transform from plain card to cinematic full-screen login:
- Split layout: left side = branding area with logo, tagline, subtle animated gradient background; right side = login form
- On mobile: single column with logo on top
- Add film grain overlay on branding side
- Glassmorphism card for form
- Smooth input focus animations
- Better error display with icon
- Add "Forgot Password?" link (even if non-functional for now)
- Use Logo component
- Staggered fade-in for form elements

**Step 2: Commit**
```bash
git add components/LoginPage.js
git commit -m "feat: redesign login page with cinematic split layout and glassmorphism"
```

---

### Task 2.3: Polish Setup Wizard

**Files:**
- Modify: `components/SetupWizard.js` (275 lines)

**Step 1: Polish the setup wizard**

- Replace emoji step icons with SVG icons
- Add smooth step transitions (slide animation between steps)
- Use Logo component at top
- Better progress indicator (connected dots with animated fill)
- Glassmorphism card
- Add subtle background pattern/gradient
- Improve review section styling in step 3
- Better button styling with hover states

**Step 2: Commit**
```bash
git add components/SetupWizard.js
git commit -m "feat: polish setup wizard with animations and improved step transitions"
```

---

## Phase 3: App Shell — Sidebar & Header
*Estimated: 3 tasks | The persistent navigation frame*

### Task 3.1: Redesign Sidebar

**Files:**
- Modify: `components/MainApp.js` — Sidebar section (lines ~2073-2200)

**Step 1: Redesign the sidebar**

Current sidebar is functional but plain. New design:
- AP Logo at the top (using Logo component, 'icon' variant when collapsed)
- Smooth collapse/expand animation (width transition, not display toggle)
- Nav items: pill-shaped active state with gradient, hover highlight, subtle icon animations
- Section dividers between nav groups
- User profile card at bottom with avatar, name, role, sign-out
- Theme toggle integrated into bottom section
- Active indicator: left edge bar that slides to current item
- Keyboard shortcut hints next to nav items (faded, e.g., "1", "2")
- On mobile: slide-in overlay with backdrop blur

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign sidebar with logo, smooth animations, and user profile card"
```

---

### Task 3.2: Redesign Top Header Bar

**Files:**
- Modify: `components/MainApp.js` — Header section (lines ~1471-1567)

**Step 1: Redesign the header**

- Clean top bar with: breadcrumb (Dashboard > Projects > Project Name), global search trigger (Cmd+K badge), notification bell with animated badge, theme toggle, user avatar dropdown
- Search: glassmorphism command palette overlay (not inline)
- Notifications: redesigned dropdown with grouped notifications, better icons, mark-all-read
- Smooth animations on dropdown open/close
- Mobile: simplified with hamburger + search icon

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign header with breadcrumbs, command palette, and notification center"
```

---

### Task 3.3: Add Page Transition Animations

**Files:**
- Modify: `components/MainApp.js` — main render section (lines ~7930-7939)

**Step 1: Add page transitions**

Wrap the view rendering in an AnimatePresence (framer-motion) or CSS-based transition:
- Fade + slight slide when switching between views (dashboard, projects, team, etc.)
- Scale-in for modals
- Slide for sidebar on mobile

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: add smooth page transition animations between views"
```

---

## Phase 4: Dashboard — The Home View
*Estimated: 2 tasks | First thing users see after login*

### Task 4.1: Redesign Dashboard Layout

**Files:**
- Modify: `components/MainApp.js` — Dashboard section (lines ~2288-2400)

**Step 1: Redesign the dashboard**

Transform from basic stat cards to:

**Welcome Section:**
- "Good morning, Harnesh" with time-based greeting
- Quick stats row: active projects, pending reviews, tasks due today, team online
- Stats as glass cards with icon, number, label, subtle gradient border

**Quick Actions Bar:**
- Horizontal row of action buttons: New Project, Upload Assets, Add Team Member, Create Task
- Each with icon + label, hover lift effect

**Recent Projects Carousel/Grid:**
- Top 4-6 recent projects as rich cards
- Each card: project cover/thumbnail (or gradient placeholder), project name, status badge, progress bar, team avatars stack, last activity time
- Hover: subtle lift + glow

**Activity Feed:**
- Right column (or below on mobile): recent activity timeline
- Redesigned timeline with better icons, grouped by time (Today, Yesterday, etc.)
- Each entry: icon, message, timestamp, clickable to navigate

**At a Glance Section:**
- Mini calendar showing upcoming deadlines
- Deadline alerts with color coding (overdue = red, today = amber, upcoming = blue)

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign dashboard with welcome section, quick actions, project cards, and activity feed"
```

---

### Task 4.2: Add Dashboard Micro-Animations

**Files:**
- Modify: `components/MainApp.js` — Dashboard section

**Step 1: Add staggered animations**

- Stat cards: staggered fadeInUp on mount
- Project cards: staggered scaleIn
- Activity items: staggered slideInLeft
- Numbers: count-up animation for stats
- Use the `.stagger-children` CSS class and framer-motion where needed

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: add dashboard micro-animations with staggered reveals and count-up stats"
```

---

## Phase 5: Projects — List & Detail Views
*Estimated: 4 tasks | Core feature of the app*

### Task 5.1: Redesign Project Cards (List View)

**Files:**
- Modify: `components/MainApp.js` — ProjectsList section (lines ~3890-4027)

**Step 1: Redesign project list cards**

Current: basic card with colored left border. New design:

- **Grid layout** with responsive columns (1/2/3 cols based on screen)
- **Card design:**
  - Top: project cover image area (gradient placeholder if no cover, based on project template type)
  - Status chip (top-right corner, colored pill)
  - Project name (bold, truncated)
  - Client name (subtle)
  - Progress bar (showing % of assets approved/delivered)
  - Bottom row: team avatar stack (max 3 + overflow count), deadline date, asset count
  - Notification badges (new uploads, pending reviews) as small dots
- **Hover effects:** lift + border glow
- **Quick actions on hover:** open, share, archive (icon buttons fade in)
- **Empty state:** illustrated empty state with "Create your first project" CTA
- **View toggle:** grid/list view option

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign project cards with cover images, progress bars, and team avatars"
```

---

### Task 5.2: Redesign Project Detail Header

**Files:**
- Modify: `components/MainApp.js` — ProjectDetail section (lines ~4833-4900)

**Step 1: Redesign project detail page header**

- **Project banner:** gradient or cover image background (full width, ~150px tall)
- **Overlay content:** project name (large), client, status badge, deadline
- **Action bar below banner:** tabs for Categories | Tasks | Decks | Settings + action buttons (Upload, Share, Edit)
- **Category tabs:** pill-shaped, horizontally scrollable, each with category icon and count badge
- **Breadcrumb:** Dashboard > Projects > [Project Name]

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign project detail header with banner, category pills, and action bar"
```

---

### Task 5.3: Redesign Asset Grid

**Files:**
- Modify: `components/MainApp.js` — Asset rendering within ProjectDetail (lines ~5009-5500)

**Step 1: Redesign the asset grid**

- **Card design:** Rounded 12px corners, subtle border, clean shadow
- **Thumbnail area:** respects aspect ratio setting, smooth image reveal
- **Overlay on hover:**
  - Top-left: version badge (v1, v2) if multiple versions
  - Top-right: status dot (color-coded)
  - Bottom: frosted glass bar with asset name, type icon, duration (if video)
  - Quick actions: preview, download, share, delete (icons fade in)
- **Selection mode:** checkbox with indigo ring, selected cards get indigo border glow
- **Video cards:** filmstrip preview bar at bottom, play icon overlay, duration badge
- **New version indicator:** subtle pulse glow on recently uploaded versions
- **Drag & drop upload zone:** dashed border area that activates on drag, with animation
- **Empty category state:** clean illustration with "Drop files here or click Upload"

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign asset grid with polished cards, hover overlays, and drag-drop zone"
```

---

### Task 5.4: Redesign Asset Lightbox / Preview Modal

**Files:**
- Modify: `components/MainApp.js` — Asset preview modal sections

**Step 1: Redesign the asset lightbox**

- **Full-screen cinematic viewer** with dark background
- **Left panel:** asset viewer (image/video), navigation arrows (prev/next)
- **Right panel (collapsible):** asset info, version history timeline, feedback chat, rating
- **Bottom bar:** annotation tools (when enabled), zoom controls
- **Version history:** visual timeline with thumbnails, click to compare
- **Feedback:** chat-bubble style messages, input at bottom
- **Keyboard shortcuts:** arrow keys for nav, Esc to close, F for fullscreen

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign asset lightbox with cinematic viewer and collapsible info panel"
```

---

## Phase 6: Team, Tasks & Other Views
*Estimated: 3 tasks*

### Task 6.1: Redesign Team Management Page

**Files:**
- Modify: `components/MainApp.js` — TeamManagement section (lines ~4028-4163)

**Step 1: Redesign team page**

- **Team cards** (grid layout) instead of table/list:
  - Large avatar with role color ring
  - Name, role badge, email
  - Stats: assigned projects count, tasks count
  - Quick actions: edit, message, view projects
  - Online status indicator (green dot)
- **Section tabs:** Core Team | Freelancers | Clients
- **Add member button:** prominent CTA with "+" icon
- **Search/filter bar** at top

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign team page with member cards and section tabs"
```

---

### Task 6.2: Polish Task Management View

**Files:**
- Modify: `components/MainApp.js` — TasksView section (lines ~2448-2732)

**Step 1: Polish the task/kanban board**

- **Column headers:** colored top border matching status, count badge
- **Task cards:**
  - Clean card with priority color left border
  - Title, due date, assigned avatar(s)
  - Subtask progress bar (3/5 done)
  - Tags/labels as small pills
  - Hover: lift effect
- **Add task:** inline "+" button at bottom of each column
- **Filter bar:** priority, assignee, project filters

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: polish task kanban board with improved cards and column styling"
```

---

### Task 6.3: Redesign Calendar View & Downloads View

**Files:**
- Modify: `components/MainApp.js` — CalendarView (lines ~1721-1848) and DownloadsView (lines ~4466-4595)

**Step 1: Polish calendar view**

- Better day cell styling with hover
- Event dots with color coding
- Selected day highlight with animation

**Step 2: Polish downloads view**

- File cards with type icon, progress bar for active downloads
- Clean grid layout

**Step 3: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: polish calendar and downloads views"
```

---

## Phase 7: Shared Components & Global Polish
*Estimated: 3 tasks*

### Task 7.1: Redesign Modals System

**Files:**
- Modify: `components/MainApp.js` — Modal component (lines ~396-416)

**Step 1: Upgrade the Modal component**

- Animated backdrop (fade in)
- Content: scale + fade in (using `.modal-content` CSS class)
- Close on Escape (already exists, keep)
- Better close button styling
- Consistent padding and border radius
- Support for different sizes: 'sm', 'md', 'lg', 'xl', 'full'

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: upgrade modal system with animations and size variants"
```

---

### Task 7.2: Redesign Toast Notifications

**Files:**
- Modify: `components/MainApp.js` — Toast component (line ~651)

**Step 1: Redesign toasts**

- Slide in from top-right (not bottom-center)
- Icon + message + close button
- Type-specific styling: success (green), error (red), info (blue), warning (amber)
- Progress bar countdown
- Stack multiple toasts
- Subtle shadow and rounded corners

**Step 2: Commit**
```bash
git add components/MainApp.js
git commit -m "feat: redesign toast notifications with slide-in animation and stacking"
```

---

### Task 7.3: Redesign Share Page (Public)

**Files:**
- Modify: `app/share/[token]/page.js` (348 lines)

**Step 1: Brand the public share page**

- Add AP Logo at top (using Logo component)
- Professional header: "Project Review — [Project Name]"
- Better asset grid for client view
- Improved feedback input with character count
- Rating display with star animation
- Selection mode with visual confirmation
- Footer: "Powered by Anandi Productions"
- Responsive design improvements

**Step 2: Commit**
```bash
git add app/share/[token]/page.js
git commit -m "feat: brand share page with AP logo and professional review interface"
```

---

## Phase 8: Loading States & Final Polish
*Estimated: 2 tasks*

### Task 8.1: Replace All Loading States

**Files:**
- Modify: `app/page.js` (line ~16: spinning gear emoji)
- Modify: `components/MainApp.js` — loading states throughout

**Step 1: Replace loading states**

- Replace spinning gear emoji with Logo component (animated breathing)
- Add skeleton screens for dashboard, project list, asset grid
- Use the `CardSkeleton` component already defined but enhance it
- Better loading text: "Preparing your workspace..." instead of "Loading..."

**Step 2: Commit**
```bash
git add app/page.js components/MainApp.js
git commit -m "feat: replace all loading states with branded skeletons and logo animation"
```

---

### Task 8.2: Mobile Responsiveness Polish

**Files:**
- Modify: `components/MainApp.js` — various sections
- Modify: `app/globals.css`

**Step 1: Mobile polish**

- Bottom navigation bar on mobile (instead of hamburger sidebar)
- Better touch targets (min 44px)
- Swipe gestures for asset navigation in lightbox
- Responsive grid adjustments (1 col on mobile, 2 on tablet)
- Modal becomes full-screen on mobile (already partial, complete it)

**Step 2: Commit**
```bash
git add components/MainApp.js app/globals.css
git commit -m "feat: polish mobile responsiveness with bottom nav and touch improvements"
```

---

## Execution Summary

| Phase | Description | Tasks | Depends On |
|-------|-------------|-------|------------|
| 1 | Foundation (Logo, CSS, Framer Motion) | 4 | None |
| 2 | Entry (Splash, Login, Setup) | 3 | Phase 1 |
| 3 | App Shell (Sidebar, Header, Transitions) | 3 | Phase 1 |
| 4 | Dashboard | 2 | Phase 3 |
| 5 | Projects (List, Detail, Assets, Lightbox) | 4 | Phase 3 |
| 6 | Team, Tasks, Calendar | 3 | Phase 3 |
| 7 | Shared Components (Modals, Toasts, Share) | 3 | Phase 1 |
| 8 | Loading States & Mobile Polish | 2 | All above |
| **Total** | | **24 tasks** | |

## Notes for Implementation

- **All styling stays inline** — the codebase uses inline styles, not Tailwind classes in JSX. Keep this consistent except for animation utilities from globals.css.
- **MainApp.js is 7942 lines** — edits must be surgical. Use exact line references.
- **Theme system** — all UI must respect the existing `THEMES` object (dark/light). Always use `t.` theme variables for colors.
- **No new dependencies** except framer-motion (already added in Phase 1).
- **Test after each phase** by running `npm run dev` and visually verifying.
- **Logo component** is used in: SplashScreen, LoginPage, SetupWizard, Sidebar, SharePage, Loading states.
