# Workflow Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Anandi Productions project workflow — from creation to approval — with proper team management, revision rounds, version comparison, and a polished glassmorphic UI.

**Architecture:** The app is a monolithic Next.js 14 app with a single 9000+ line MainApp.js. We will extract new features into separate component files to reduce complexity. Data layer is Firebase/Firestore via lib/firestore.js. We keep the existing data model and extend it — no migrations needed since Firestore is schemaless.

**Tech Stack:** Next.js 14, React 18, Firebase/Firestore, Mux (video), framer-motion (animations), inline styles (existing pattern — no Tailwind in components).

---

## Phase Overview

| Phase | What | Priority | Est. Tasks |
|-------|------|----------|------------|
| **P1** | Quick Fixes (annotation exit, delete button, sidebar width) | Immediate | 3 tasks |
| **P2** | Right Sidebar Redesign (collapsible glassmorphic panels) | High | 4 tasks |
| **P3** | Project Creation Overhaul (multi-step modal + templates) | High | 5 tasks |
| **P4** | Team Management (add/remove post-creation, team groups) | High | 4 tasks |
| **P5** | Revision Rounds & Auto-Turnaround | Medium | 4 tasks |
| **P6** | Version Comparison (side-by-side, overlay, swipe) | Medium | 3 tasks |
| **P7** | Discussion Trail & Activity Feed | Medium | 3 tasks |
| **P8** | Agency Role & Handoff System | Medium | 4 tasks |
| **P9** | Basic Image Editor (crop + export) | Low | 2 tasks |
| **P10** | UI/UX Polish Pass (glassmorphic, spacing, typography) | Low | 3 tasks |

---

## Phase 1: Quick Fixes

### Task 1.1: Fix Annotation Exit (Click Outside + ESC)

**Files:**
- Modify: `components/MainApp.js` — the asset detail view where `assetTab === 'annotate'` is rendered (~line 7656)
- Modify: `components/AnnotationCanvas.js` — add onClickOutside callback

**Step 1:** In `MainApp.js`, find where `AnnotationCanvas` is rendered (search for `assetTab === 'annotate'`). Wrap it in a div with an `onMouseDown` handler on the parent content area that detects clicks outside the canvas and sets `assetTab` back to `'preview'`.

```javascript
// In the content area div (line ~7296), add:
onMouseDown={(e) => {
  if (assetTab === 'annotate' && e.target === e.currentTarget) {
    // Save annotations before exiting
    if (selectedAsset.annotations?.length > 0) handleSaveAnnotations(selectedAsset.annotations);
    setAssetTab('preview');
  }
}}
```

**Step 2:** Add ESC key handling in the keyboard shortcuts useEffect (line ~5661). Inside `handleKeyNav`, add before the existing checks:

```javascript
if (e.key === 'Escape' && assetTab === 'annotate') {
  e.preventDefault();
  setAssetTab('preview');
  return; // Don't process other shortcuts
}
```

**Step 3:** In `AnnotationCanvas.js`, add auto-save on unmount by adding a cleanup effect:

```javascript
useEffect(() => {
  return () => {
    // Auto-save on unmount if there are unsaved changes
    if (shapes.length > 0 && onChange) onChange(shapes);
  };
}, [shapes, onChange]);
```

**Step 4:** Verify — switch to annotate mode, draw something, click outside the canvas. Should exit and save. Press ESC. Should exit.

**Step 5:** Commit: `fix: annotation exit via click-outside and ESC key`

---

### Task 1.2: Fix Delete Button (Move to Three-Dot Menu)

**Files:**
- Modify: `components/MainApp.js` — right sidebar section (~line 8176)

**Step 1:** Find the delete button (search for `Delete</button>` in the sidebar, ~line 8176-8179). Remove the full-width red delete button.

**Step 2:** Find the "Download Preview" button (~line 8172). Replace both buttons with a three-dot actions menu:

```javascript
{/* Actions Menu */}
<div style={{ position: 'relative' }}>
  <button onClick={() => setShowAssetMenu(!showAssetMenu)} style={{
    width: '100%', padding: '10px', background: 'none',
    border: `1px solid ${t.borderLight}`, borderRadius: '10px',
    color: t.textMuted, cursor: 'pointer', fontSize: '11px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
    </svg>
    More Actions
  </button>
  {showAssetMenu && (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
      background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '10px',
      padding: '4px', zIndex: 50, boxShadow: t.shadow
    }}>
      {/* Download Preview */}
      <div onClick={() => { /* existing download logic */ setShowAssetMenu(false); }}
        style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}
        onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        ↓ Download Preview
      </div>
      {/* Copy Share Link */}
      <div onClick={() => { navigator.clipboard.writeText(selectedAsset.url); showToast('Link copied', 'success'); setShowAssetMenu(false); }}
        style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}
        onMouseEnter={e => e.currentTarget.style.background = t.bgHover}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        🔗 Copy Share Link
      </div>
      {/* Delete — only for producer */}
      {isProducer && (
        <div onClick={() => { /* existing delete logic */ setShowAssetMenu(false); }}
          style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', borderTop: `1px solid ${t.borderLight}`, marginTop: '4px', paddingTop: '12px' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          🗑 Delete Asset
        </div>
      )}
    </div>
  )}
</div>
```

**Step 3:** Add `showAssetMenu` state: `const [showAssetMenu, setShowAssetMenu] = useState(false);`

**Step 4:** Add click-outside-to-close effect for the menu.

**Step 5:** Commit: `fix: replace ugly red delete button with three-dot actions menu`

---

### Task 1.3: Quick Sidebar Spacing Fix

**Files:**
- Modify: `components/MainApp.js` — sidebar container (~line 7926)

**Step 1:** Find the sidebar container (search for `width: assetPanelCollapsed ? '0px' :` in the detail panel area, or find the 280px sidebar). Change width from `280px` to `320px`.

**Step 2:** Increase all section margins from `12px` to `16px` (search/replace `marginBottom: '12px'` in the sidebar section).

**Step 3:** Increase minimum font sizes — find all `fontSize: '9px'` in the sidebar and change to `'11px'`. Find `fontSize: '10px'` and change to `'12px'` where it's body text (not labels).

**Step 4:** Commit: `fix: sidebar width 320px, better spacing and font sizes`

---

## Phase 2: Right Sidebar Redesign

### Task 2.1: Create CollapsibleSection Component

**Files:**
- Create: `components/CollapsibleSection.js`

**Step 1:** Create a reusable collapsible section component with glassmorphic styling:

```javascript
'use client';
import { useState } from 'react';

export default function CollapsibleSection({ title, badge, defaultOpen = true, children, theme }) {
  const [open, setOpen] = useState(defaultOpen);
  const t = theme;
  return (
    <div style={{
      marginBottom: '12px',
      background: `${t.bgCard}CC`,
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${t.borderLight}`,
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '12px 14px',
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: t.text, fontSize: '12px', fontWeight: '600'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title}
          {badge && <span style={{
            fontSize: '10px', padding: '2px 8px',
            borderRadius: '10px', fontWeight: '600',
            background: badge.bg, color: badge.color
          }}>{badge.text}</span>}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}><polyline points="6,9 12,15 18,9"/></svg>
      </button>
      {open && <div style={{ padding: '0 14px 14px 14px' }}>{children}</div>}
    </div>
  );
}
```

**Step 2:** Commit: `feat: add CollapsibleSection component with glassmorphic styling`

---

### Task 2.2: Create AssetSidebar Component

**Files:**
- Create: `components/AssetSidebar.js`
- Modify: `components/MainApp.js` — extract sidebar into new component

**Step 1:** Create `AssetSidebar.js` that receives props from MainApp and renders the redesigned sidebar using CollapsibleSection. This component contains:

- **Header**: Asset name, status pill, round indicator
- **Section 1 — Assignment**: Team/person, pipeline indicator, due date, "Mark Complete"
- **Section 2 — Versions**: Version stack, compare button, upload, GDrive
- **Section 3 — Feedback**: Threaded feedback with @mentions (existing feedback logic moved here)
- **Section 4 — File Details**: Collapsed by default, size/type/date, requirements checklist
- **Actions menu**: Three-dot with download/delete/share

**Step 2:** Wire up all the existing handlers from MainApp as props: `onStatusChange`, `onAddFeedback`, `onToggleFeedbackDone`, `onUploadVersion`, `onDelete`, etc.

**Step 3:** In MainApp.js, replace the inline sidebar section (~lines 7926-8200) with:
```javascript
<AssetSidebar
  asset={selectedAsset}
  project={selectedProject}
  theme={t}
  userProfile={userProfile}
  isProducer={isProducer}
  videoRef={videoRef}
  videoTime={videoTime}
  onStatusChange={handleStatusChange}
  onAddFeedback={handleAddFeedback}
  // ... other handlers
/>
```

**Step 4:** Commit: `refactor: extract AssetSidebar component from MainApp`

---

### Task 2.3: Style the Sidebar Sections with Glassmorphic Cards

**Files:**
- Modify: `components/AssetSidebar.js`

**Step 1:** Implement the status pill header with large colored badge:
```javascript
const statusColors = {
  pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', text: 'Pending' },
  'in-progress': { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', text: 'In Progress' },
  'changes-requested': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', text: 'Changes Requested' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', text: 'Approved' },
};
```

**Step 2:** Implement the version stack with thumbnails and "Compare" button linking to existing VersionComparison component.

**Step 3:** Implement threaded feedback — each feedback item becomes a thread that can have replies. Data model change: feedback items gain a `replies` array and `resolved` boolean.

**Step 4:** Commit: `feat: glassmorphic sidebar sections with status pills and threaded feedback`

---

### Task 2.4: Wire Up Sidebar to MainApp

**Files:**
- Modify: `components/MainApp.js`
- Modify: `components/AssetSidebar.js`

**Step 1:** Import AssetSidebar in MainApp. Pass all required props.

**Step 2:** Add the `highlightedFeedbackId` integration — when a comment marker is clicked on the video timeline, the sidebar auto-scrolls to that feedback thread.

**Step 3:** Test: Open an asset, verify all sections render, collapse/expand works, feedback submission works, version upload works.

**Step 4:** Commit: `feat: wire AssetSidebar into MainApp with all handlers`

---

## Phase 3: Project Creation Overhaul

### Task 3.1: Create Multi-Step Project Modal Component

**Files:**
- Create: `components/CreateProjectModal.js`

**Step 1:** Build a 5-step modal with step indicators at top. Each step is a screen:

- Step 1: Basics (name, client, type, deadline, template selector)
- Step 2: Workflow (type, max rounds, auto-turnaround, approval chain)
- Step 3: Teams (add team groups or individuals)
- Step 4: Deliverables (formats, sizes — optional, can skip)
- Step 5: Summary + Create

Step indicator: numbered circles connected by lines, filled for completed steps.

**Step 2:** Build Step 1 UI — form fields with glassmorphic input styling. Template dropdown at top that pre-fills all fields when selected.

**Step 3:** Commit: `feat: multi-step project creation modal — step 1 basics`

---

### Task 3.2: Workflow Configuration Step

**Files:**
- Modify: `components/CreateProjectModal.js`

**Step 1:** Build Step 2 UI — three workflow type cards (Direct / Standard / Agency) with visual diagrams showing the approval chain.

**Step 2:** Add max rounds selector (number input, default 3), auto-turnaround toggle (default ON, 24hr), approval chain radio buttons.

**Step 3:** Commit: `feat: project creation step 2 — workflow configuration`

---

### Task 3.3: Teams Step

**Files:**
- Modify: `components/CreateProjectModal.js`

**Step 1:** Build Step 3 UI:
- "Add Team Group" button → creates a named group with member picker
- Member picker: searchable dropdown of all users (from coreTeam + freelancers)
- Each group shows: name, member avatars, team lead selector
- "Or add individuals" section for simple projects

**Step 2:** Commit: `feat: project creation step 3 — team groups and members`

---

### Task 3.4: Deliverables + Summary Steps

**Files:**
- Modify: `components/CreateProjectModal.js`

**Step 1:** Build Step 4 — format checkboxes (JPEG, TIFF, PNG, PSD, MP4, MOV) and size presets (1080p, 4K, Instagram Square, Story, etc.)

**Step 2:** Build Step 5 — summary card showing all configured settings. "Save as Template" checkbox. "Create Project" button.

**Step 3:** Commit: `feat: project creation steps 4-5 — deliverables and summary`

---

### Task 3.5: Wire Up Modal + Template System

**Files:**
- Modify: `components/MainApp.js` — replace old create modal
- Modify: `lib/firestore.js` — add template CRUD

**Step 1:** Add to firestore.js:
```javascript
export const getTemplates = async () => { /* query templates collection */ };
export const createTemplate = async (data) => { /* save to templates collection */ };
export const deleteTemplate = async (id) => { /* delete from templates */ };
```

**Step 2:** In MainApp.js, replace the old `showCreate` modal (lines ~4490-4560) with the new CreateProjectModal component.

**Step 3:** Update `handleCreate` to accept the full project config from the new modal (workflow type, teams, rounds, deliverables, etc.)

**Step 4:** Extended project schema — add these fields to the createProject call:
```javascript
{
  workflowType: 'direct' | 'standard' | 'agency',
  maxRevisions: 3,
  autoTurnaround: true,
  turnaroundHours: 24,
  approvalChain: ['producer'] | ['producer', 'client'] | ['producer', 'agency', 'client'],
  teamGroups: [{ id, name, members: [userId], leadId: userId }],
  deliverableFormats: ['jpeg', 'tiff'],
  deliverableSizes: ['1080p', '4k'],
  agencyContacts: [],
  templateId: null,
}
```

**Step 5:** Commit: `feat: wire multi-step creation modal with template system`

---

## Phase 4: Team Management

### Task 4.1: Team Management Panel in Project Settings

**Files:**
- Create: `components/TeamManager.js`

**Step 1:** Create a team management component accessible from project settings (or a "Team" tab in project detail). Shows:
- All team groups with members
- "Add Group" button
- "Add Member" to any group
- "Remove Member" with confirmation
- Team lead selector per group
- Drag to reorder members

**Step 2:** Commit: `feat: TeamManager component for post-creation team editing`

---

### Task 4.2: Asset-Level Team Assignment

**Files:**
- Modify: `components/AssetSidebar.js` — assignment section
- Modify: `components/MainApp.js` — bulk actions

**Step 1:** Replace the simple "Assign To" dropdown with a team-aware assignment picker:
- Shows team groups as sections
- Can assign to group (all members see it) or individual
- Bulk assignment: select multiple assets → "Assign to..." dropdown

**Step 2:** Update asset data model — `assignedTo` becomes `assignedTo: { type: 'team'|'individual', id: string, teamName?: string }`.

**Step 3:** Commit: `feat: asset-level team and individual assignment`

---

### Task 4.3: Handoff Chain Configuration

**Files:**
- Create: `components/HandoffChain.js`

**Step 1:** Build a handoff chain editor — visual pipeline builder:
- Drag team groups into a sequence
- Arrow connectors between stages
- Per-asset or per-category scope selector
- "When [Team] marks complete → auto-assign to [Next Team]"

**Step 2:** Store handoff chains on the project:
```javascript
handoffChains: [
  { id, scope: 'category'|'asset', scopeId: string, stages: [{ teamGroupId, order }] }
]
```

**Step 3:** Commit: `feat: handoff chain configuration with visual pipeline builder`

---

### Task 4.4: Auto-Handoff on Mark Complete

**Files:**
- Modify: `components/MainApp.js` — "Mark Complete" handler

**Step 1:** When an editor clicks "Mark Complete" on an asset:
1. Check if asset has a handoff chain
2. Find current stage in chain
3. If next stage exists → auto-assign asset to next team, change status to 'pending', send notification
4. If no next stage → move to review (client/agency)
5. Log handoff in activity log

**Step 2:** Add notification creation for handoff events.

**Step 3:** Commit: `feat: auto-handoff on mark complete with notifications`

---

## Phase 5: Revision Rounds & Auto-Turnaround

### Task 5.1: Round Tracking Data Model & UI

**Files:**
- Modify: `components/AssetSidebar.js` — round indicator
- Modify: `components/MainApp.js` — feedback handler

**Step 1:** Add to asset data model:
```javascript
{
  currentRound: 1,
  maxRounds: 3, // inherited from project
  roundHistory: [{ round: 1, feedbackCount: 3, resolvedAt: timestamp, versionId: string }],
}
```

**Step 2:** In the sidebar header, render round indicator: colored dots showing progress (e.g., "● ● ○" for Round 2 of 3).

**Step 3:** Commit: `feat: round tracking data model and visual indicator`

---

### Task 5.2: Auto-Advance Rounds

**Files:**
- Modify: `components/MainApp.js` — version upload handler + feedback handler

**Step 1:** In the version upload handler, after a new version is created:
1. Check if all feedback in current round is marked resolved
2. If yes → increment `currentRound`, archive round in `roundHistory`
3. Reset feedback resolved states for the new round
4. Log "Round N started" in activity

**Step 2:** Add manual "Close Round" button for producers in the sidebar round indicator.

**Step 3:** Commit: `feat: auto-advance rounds on version upload + manual override`

---

### Task 5.3: Round Limit Enforcement (Client View)

**Files:**
- Modify: `app/share/[token]/page.js` — client share view

**Step 1:** In the share view, show "Round X of Y" prominently.

**Step 2:** When `currentRound > maxRounds`, replace the feedback input with:
```
"Maximum revision rounds reached. Additional revisions require approval."
[Request Additional Round] button → sends notification to producer
```

**Step 3:** Producer receives notification with approve/decline + cost note field.

**Step 4:** Commit: `feat: round limit enforcement with additional round request flow`

---

### Task 5.4: Auto-Turnaround Timer

**Files:**
- Modify: `components/MainApp.js` — feedback handler
- Modify: `components/AssetSidebar.js` — timer display

**Step 1:** When feedback is added to an asset, set:
```javascript
turnaroundDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
```

**Step 2:** In the sidebar assignment section, show a countdown badge:
- Green: > 12hrs remaining
- Amber: 2-12hrs remaining
- Red: < 2hrs or overdue
- Pulsing animation when < 1hr

**Step 3:** Add "Request Extension" button → modal with reason field → notification to producer.

**Step 4:** Commit: `feat: 24hr auto-turnaround timer with extension requests`

---

## Phase 6: Version Comparison

### Task 6.1: Side-by-Side Image Comparison

**Files:**
- Modify: `components/VersionComparison.js` (existing file)

**Step 1:** Read existing VersionComparison.js and extend it with three comparison modes:
- **Side-by-side**: Two images next to each other, synced zoom/pan
- **Overlay**: V2 overlaid on V1 with opacity slider (0-100%)
- **Swipe**: Vertical divider, drag to reveal V1 vs V2

Mode selector as three icon buttons at top.

**Step 2:** Implement synced zoom: when user zooms/pans one image, the other follows.

**Step 3:** Commit: `feat: three-mode image version comparison`

---

### Task 6.2: Video Version Comparison

**Files:**
- Modify: `components/VersionComparison.js`

**Step 1:** Add video support: two synced video players side by side.
- Shared play/pause control
- Synced timecodes
- Uses the same custom video player controls from Phase 1

**Step 2:** Commit: `feat: synced video version comparison`

---

### Task 6.3: Wire Comparison into Asset Detail

**Files:**
- Modify: `components/AssetSidebar.js` — versions section
- Modify: `components/MainApp.js` — compare tab

**Step 1:** In the versions section, add "Compare" button next to each version. Clicking opens comparison view with that version vs current.

**Step 2:** The existing "Compare" tab in asset detail should use the new VersionComparison component.

**Step 3:** Commit: `feat: wire version comparison into sidebar and compare tab`

---

## Phase 7: Discussion Trail & Activity Feed

### Task 7.1: Activity Feed Component

**Files:**
- Create: `components/ActivityFeed.js`

**Step 1:** Build chronological activity feed showing all events:
- Icons per type: 💬 feedback, 📤 upload, ✅ status change, 🔄 round, 🤝 handoff, ⏱ timer
- Each entry: icon, description, user avatar, timestamp
- Filter buttons: All / Feedback / Status / Team

**Step 2:** Commit: `feat: ActivityFeed component with event types and filters`

---

### Task 7.2: Threaded Replies on Feedback

**Files:**
- Modify: `components/AssetSidebar.js` — feedback section

**Step 1:** Each feedback item gets a "Reply" button. Clicking shows an inline reply input.

**Step 2:** Data model: feedback items gain `replies: [{ id, text, userId, userName, timestamp }]`.

**Step 3:** Add `@mention` support in replies — type `@` to see team member picker, selecting inserts `@Name`.

**Step 4:** Commit: `feat: threaded feedback replies with @mentions`

---

### Task 7.3: Wire Activity Tab into Asset Detail

**Files:**
- Modify: `components/MainApp.js` — asset detail tabs

**Step 1:** Add "Activity" to the tab list: `['preview', 'annotate', 'compare', 'activity']`.

**Step 2:** When `assetTab === 'activity'`, render the ActivityFeed component with all events for the selected asset.

**Step 3:** All existing activity log writes throughout MainApp should include the new event types (handoff, round, timer).

**Step 4:** Commit: `feat: activity tab in asset detail view`

---

## Phase 8: Agency Role & Handoff

### Task 8.1: Agency Role Type

**Files:**
- Modify: `lib/firestore.js` — add agency role
- Modify: `components/MainApp.js` — role checks

**Step 1:** Add to CORE_ROLES in firestore.js: `'agency': 'Agency'`.

**Step 2:** Add agency-specific permissions: can view all assets, can give feedback, can approve/reject, cannot upload versions, cannot delete.

**Step 3:** Commit: `feat: agency role type with permissions`

---

### Task 8.2: Agency Contacts on Project

**Files:**
- Modify: `components/CreateProjectModal.js` — workflow step
- Modify: `components/TeamManager.js`

**Step 1:** When workflow type is "Agency", show an "Agency Contacts" section in Step 3. These are external contacts (name + email) who get notified.

**Step 2:** Store on project: `agencyContacts: [{ id, name, email, role: 'agency' }]`.

**Step 3:** Commit: `feat: agency contacts in project creation and team manager`

---

### Task 8.3: Agency Review Stage

**Files:**
- Modify: `components/MainApp.js` — approval workflow

**Step 1:** When an asset reaches the review stage and the project has `workflowType: 'agency'`:
1. Asset goes to Agency first (status: 'agency-review')
2. Agency approves → moves to Client review
3. Agency requests changes → goes back to team

**Step 2:** Agency feedback is tagged with a distinct badge color (blue).

**Step 3:** Commit: `feat: agency review stage in approval workflow`

---

### Task 8.4: Agency Notifications

**Files:**
- Modify: `components/MainApp.js` — notification creation
- Modify: `app/api/send-email/route.js`

**Step 1:** When assets move to agency-review stage, send email notifications to all agency contacts.

**Step 2:** Agency contacts also get daily digest emails if configured.

**Step 3:** Commit: `feat: agency email notifications`

---

## Phase 9: Basic Image Editor

### Task 9.1: Crop Tool Component

**Files:**
- Create: `components/ImageCropper.js`

**Step 1:** Build a canvas-based crop tool:
- Loads image into canvas
- Overlay with draggable crop handles (corners + edges)
- Preset aspect ratios: 1:1, 4:5, 9:16, 16:9, 3:4, Free
- Preset buttons at top
- Live preview of cropped area

**Step 2:** Export function: crops canvas to blob, triggers download as JPEG or PNG with quality selector.

**Step 3:** Commit: `feat: ImageCropper component with aspect ratio presets and export`

---

### Task 9.2: Wire Cropper into Asset Preview

**Files:**
- Modify: `components/MainApp.js` — asset preview area

**Step 1:** Add a "Crop & Export" button in the image preview toolbar (near the zoom controls).

**Step 2:** Clicking opens the ImageCropper in a modal overlay with the current image.

**Step 3:** Commit: `feat: crop & export button in image preview`

---

## Phase 10: UI/UX Polish Pass

### Task 10.1: Glassmorphic Theme System

**Files:**
- Modify: `components/MainApp.js` — theme objects (~line 120-170)

**Step 1:** Update the dark theme object with glassmorphic properties:
```javascript
bgGlass: 'rgba(30,30,45,0.7)',
bgGlassBorder: 'rgba(255,255,255,0.08)',
blur: 'blur(16px)',
cardRadius: '16px',
shadowGlass: '0 4px 24px rgba(0,0,0,0.2)',
gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
gradientSuccess: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
```

**Step 2:** Update all card/panel backgrounds throughout the app to use `bgGlass` + `backdropFilter: blur`.

**Step 3:** Commit: `feat: glassmorphic theme tokens`

---

### Task 10.2: Typography & Spacing Pass

**Files:**
- Modify: `components/MainApp.js`
- Modify: `components/AssetSidebar.js`

**Step 1:** Global find-and-fix:
- Replace all `fontSize: '9px'` with `'11px'` minimum
- Replace all `fontSize: '8px'` with `'10px'` minimum
- Ensure all `marginBottom` between sections is at least `16px`
- Ensure all `padding` inside cards is at least `14px`
- Ensure all `borderRadius` on cards is at least `12px`

**Step 2:** Commit: `style: typography and spacing polish pass`

---

### Task 10.3: Animated Transitions

**Files:**
- Modify: `components/CollapsibleSection.js`
- Modify: `components/AssetSidebar.js`
- Modify: `components/MainApp.js`

**Step 1:** Add framer-motion animations (already a dependency):
- Sidebar sections: smooth height animation on expand/collapse
- Status pill: color transition animation
- Modal steps: slide-left/right transitions
- Toast notifications: slide + fade

**Step 2:** Commit: `style: framer-motion transitions for sidebar and modals`

---

## Implementation Notes

**Key architectural decisions:**
1. **New components are separate files** — don't add more to MainApp.js (it's already 9000+ lines)
2. **Firestore schema is additive** — new fields are added to existing documents, no migrations needed
3. **Inline styles** — match existing pattern in MainApp.js, don't introduce CSS modules
4. **framer-motion** — already installed, use for all new animations
5. **Role checks** — `isProducer` pattern already exists, extend it for `isAgency`, `isEditor`, etc.

**Testing approach:**
- After each task, run `npx esbuild --bundle --jsx=automatic --loader:.js=jsx components/MainApp.js --outfile=/dev/null` to verify syntax
- Visual testing via preview server when Firebase env is available
- Test each workflow path: create project → assign team → upload asset → get feedback → new version → rounds → approval

**Commit strategy:**
- One commit per task
- Prefix: `feat:`, `fix:`, `refactor:`, `style:`
- Each commit should leave the app in a working state
