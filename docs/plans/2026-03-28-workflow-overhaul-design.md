# Anandi Productions — Workflow Overhaul Design

**Date:** 2026-03-28
**Status:** Approved

---

## Problem Statement

The current project workflow is broken: project creation collects minimal details, team members can't be added after creation, there are no templates, no revision round tracking, no agency role, the right sidebar is cramped and ugly, annotations can't be exited by clicking outside, and there's no discussion trail for changes.

## Design

### 1. Project Creation (Multi-Step Modal)

**Step 1 — Basics:** Name, Client, Type, Deadline, Template selector (saved configs or "Start from scratch").

**Step 2 — Workflow Configuration:**
- Workflow type: Direct (Producer → Client), Standard (Producer → Teams → Client), Agency (Producer → Teams → Agency → Client)
- Max revision rounds per asset (default 3)
- Auto-turnaround: 24hr default from feedback, with "Request Extension" for complex changes
- Approval chain: who gives final sign-off (Producer / Client / Agency)

**Step 3 — Teams:**
- Named team groups (e.g., "CGI Team", "Photo Retouching", "Animation A")
- Each group has members + team lead
- Simple projects: skip groups, add individuals
- Teams can be added/removed at any time after creation

**Step 4 — Deliverable Requirements (optional):**
- Required formats (JPEG, TIFF, PNG, PSD, MP4, MOV)
- Required resolutions/sizes
- These become checkboxes editors must fulfill

**Step 5 — Summary & Create:**
- Review all settings
- "Save as Template" checkbox for reuse

### 2. Team & Handoff System

**Asset-level assignment:** Any asset can be assigned to a team group or individual. Bulk assignment supported.

**Inter-team handoffs:** Producer defines per-asset or per-category handoff chains (e.g., "CGI Team done → auto-assign to Photo Retouching"). Visual pipeline indicator on each asset shows current stage.

**Editor upload workflow:**
- Editor sees: current version, all feedback, file requirements checklist
- "Upload New Version" → auto-creates V2/V3/etc.
- "Mark as Complete" → triggers next pipeline stage notification
- Requirements checklist must be satisfied before marking complete

**Agency role:**
- New role type between Producer and Client in approval chain
- Can view all assets, give feedback (tagged differently), approve/reject before client
- Receives notifications at their review stage

### 3. Revision Rounds & Auto-Turnaround

**Auto-advance rounds:** All feedback addressed + new version uploaded → round increments.

**Manual override:** Producer can force-close or reset rounds.

**Round limit enforcement:**
- Client/Agency sees "Round 2 of 3"
- At limit: "Additional revisions require approval for extra charges"
- "Request Additional Round" → Producer notification → approve/decline with cost note
- Creates signed-off record

**Auto-turnaround:**
- Feedback submitted → 24hr countdown on that asset
- Visible countdown badge for assigned editor/team
- "Request Extension" button → goes to Producer with reason
- Producer approves new deadline or keeps 24hr

### 4. Version Comparison

- **Side-by-side:** V1 left, V2 right, synced scroll/zoom (images)
- **Overlay:** V2 over V1 with opacity slider
- **Swipe:** Drag divider to reveal V1 vs V2
- **Video:** Synced playback of both versions with timecoded controls
- Accessible from version dropdown → "Compare with..."
- Available to Producer, Editor, Agency, Client

### 5. Right Sidebar Redesign

**Width:** 320px (up from 280px). Glassmorphic dark cards, collapsible sections.

**Always visible header:**
- Asset name + type icon
- Status pill (Pending / In Review / Changes Requested / Approved)
- Round indicator with progress dots

**Section 1 — Assignment** (open by default):
- Assigned team/person with avatar
- Pipeline indicator with current stage highlighted
- Due date with countdown
- "Mark Complete" button

**Section 2 — Versions** (open by default):
- Version stack with thumbnails
- "Compare" button between versions
- "Upload New Version" button
- GDrive link input

**Section 3 — Feedback** (open by default):
- Threaded feedback with replies
- @mentions, timecode badges (clickable)
- "Resolved" toggle per thread
- Unresolved count on header

**Section 4 — File Details** (collapsed by default):
- Size, type, date, resolution
- Deliverable requirements checklist
- Download buttons

**Actions menu** (three-dot button):
- Download preview/high-res
- Delete asset
- Copy share link

### 6. Annotation Fixes

- Click outside canvas → exit annotation mode
- ESC key → exit annotation mode
- Auto-save annotations on exit
- Same behavior for video annotations (Phase 2)

### 7. Discussion Trail

New "Activity" tab on asset detail view:
- Chronological feed: feedback, version uploads, status changes, round transitions, handoffs, timer events
- Threaded replies on any item
- @mention anyone on the project (triggers notification)
- Filter by: All / Feedback / Status changes / Team activity

### 8. Basic Image Editor

- "Crop & Export" button on Preview tab
- Crop presets: 1:1, 4:5, 9:16, 16:9, 3:4, custom
- Free crop with drag handles
- Export: download cropped image in JPEG/PNG at selected quality

### 9. UI/UX Direction

- Dark-first glassmorphic design with translucent blur cards
- 16px minimum spacing between sections, 12px internal padding
- 12-16px rounded corners on cards/panels
- Colored accent badges (green=approved, amber=pending, red=changes)
- 12-13px minimum body text (no more 9px)
- Smooth animated transitions for expand/collapse
- Gradient accents on primary actions
