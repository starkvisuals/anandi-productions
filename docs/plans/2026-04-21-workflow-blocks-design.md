# Workflow Blocks — Modular Stage Architecture

**Date:** 2026-04-21
**Status:** Approved for implementation (Phase 1 = Photoshoot end-to-end)
**Owner:** Harnesh
**Supersedes:** 2026-03-28-workflow-overhaul-design.md (selection/approval portions)

---

## Context

Anandi Productions currently exposes every piece of project information at once — status, versions, feedback, revisions, approvals, selection stars — on the same UI surface. This breaks mid-project clients who are trying to cull 500 images down to 40 and don't care about "R1/3 • Pending • Due Apr 26." It also forces producers to coordinate manually over WhatsApp because the app has no notion of stages or role-aware inboxes.

Harnesh runs ~5 concurrent projects across photo, ad-film, social, and event recording. Each has different workflows. Employees forget tasks, clients ghost reviews, follow-ups leak into someone's head. The goal of this rework is to make the app replace the coordinator role — automate the hand-offs, own the timeline, remember the follow-ups.

## Problem statement

1. **No stages** — selection, post-production, approval, delivery all share one UI. Clients see editor internals during selection.
2. **No role-scoped UI** — everybody sees everything, cluttered.
3. **No cross-project inbox** — employees navigate project-by-project to find their work.
4. **No auto hand-off** — when selection is submitted, nobody is auto-notified to assign editor.
5. **No template system** — every new workflow type requires a code change.
6. **Selection UX is desktop-only and heavy** — clients need mobile swipe-rate, snapshots, simple submit.
7. **No activity trail** — decisions get buried in WhatsApp, chats, email threads.
8. **No deliverables contract** — "did we actually hand over all 50 promised shots?" can only be answered by memory.

## Goals

- **Modular stage architecture.** Every workflow = a sequence of reusable blocks. Templates are data, not code. Harnesh can add new workflows (AI generation, retainer edits, post-only) without a developer.
- **Role-scoped UI.** Clients see selection/approval surfaces only. Editors see brief + reference pinning + version upload. Producers see everything + coordination overlays.
- **One inbox per user, across all projects.** "What needs my action today, this week, overdue."
- **Auto-notifications on every stage transition.** Nobody chases.
- **Reliable follow-ups via SLAs.** Client has 48h to review → reminder → escalation.
- **Activity feed + project snapshot.** New joiners catch up in 2 minutes.
- **Mobile-first selection.** Swipe-rate, color labels, stars, multi-round, snapshot-on-submit.
- **Asset requests as a side-channel.** Editor asks producer asks client; fulfilment auto-routes back.
- **Reference pinning.** Producer pins logos/CGI/stock/fonts/briefs to specific assets.
- **Deliverables checklist.** Project creation defines the promised output; delivery block validates it.

## Non-goals (Phase 1)

- **Pre-production blocks** (MoodBoard / ShotList / CallSheet). Post-shoot app only.
- **Invoicing, budget tracker, revenue dashboard.** Deferred.
- **Full AdFilm / Social / Event template UIs.** Data model supports them; only Photoshoot is wired end-to-end in Phase 1.
- **In-app tutorials / onboarding walkthroughs.** After app is stable.
- **Offline-first PWA / native apps.** Web + mobile-web only.
- **Legal / print / script approval blocks.** Client's problem, not ours.
- **Refactor of MainApp.js.** Explicitly deferred — additive changes only.

---

## Architecture

### The Lego model

```
Blocks (primitives, code)    = reusable stage types with known shape
Templates (compositions, data) = ordered sequence of block instances
Projects (instances, data)   = templates cloned and materialized into Firestore
```

**Blocks = code.** A fixed library of ~8 primitive types. Adding a truly new primitive requires a developer — but the library is intentionally generic enough that 99% of workflows compose from the existing set.

**Templates = data.** Stored in Firestore under `workflowTemplates/{id}`. Harnesh edits them in an in-app editor. System ships with `Photoshoot` as default. Ad Film / Social / AI Generation / Retainer etc. are built in the editor whenever needed — no code change.

**Projects = instances.** When Harnesh creates a project from a template, the template's block array is cloned into `projects/{pid}/blocks/{bid}` subcollection. Each block is now independently mutable — advance, reassign, reorder, insert, delete — without affecting the template.

### Block library

| Type | Variants | Actors | Purpose |
|---|---|---|---|
| **UploadBlock** | `raws` · `references` · `offline-edit` · `hi-res` | producer / photographer-via-link / editor | Ingest files into the project |
| **SelectionRound** | — | client | Multi-round rating (stars 1–5 + 7 colors) with snapshot on submit |
| **ProductionBlock** | `edit` · `grading` · `vfx` · `audio` · `music` · `supers` · `ai-gen` · `generic` | editor / colorist / vfx / audio / composer | Work is done; new version uploaded |
| **ApprovalRound** | mode: `correction-or-approve` · `pick-one-of-many` | client / agency | Client reviews; approves or requests corrections with annotations; or picks from options (e.g., supers) |
| **AdaptBlock** | — | editor | Editor produces adapts of approved masters against a checklist |
| **DeliveryBlock** | — | client | Client downloads; producer releases hi-res |
| **Checkpoint** | — | producer | Manual gate — producer must confirm to advance |
| **Parallel** | container | any | Runs N child blocks side-by-side; all must complete |

**Cross-cutting features** (not blocks, available inside any block):

- **AssetRequest** — any actor can request files from another role via the producer gateway
- **Annotations** — draw on any asset with optional comment
- **References** — producer uploads to project-level reference library; can pin to specific assets
- **Notes** — threaded comment on any asset, block, or the project itself
- **Activity feed** — every event auto-posts; @mentions supported

### Template composition examples

| Template | Sequence |
|---|---|
| Photoshoot | `UploadBlock(raws) → SelectionRound → Checkpoint(producer-assigns-editor) → ProductionBlock(edit) → ApprovalRound(correction) → AdaptBlock → DeliveryBlock` |
| Ad Film (full) | `UploadBlock(raws) → UploadBlock(offline-edit) → ApprovalRound → ProductionBlock(grading) → ApprovalRound → ProductionBlock(vfx) → Parallel[ProductionBlock(audio), ProductionBlock(music)] → ApprovalRound → DeliveryBlock` |
| Ad Film (low-budget) | `UploadBlock(raws) → ProductionBlock(edit) → ApprovalRound → DeliveryBlock` |
| Social Reel | `UploadBlock(raws) → ProductionBlock(edit) → ApprovalRound(correction) → DeliveryBlock` |
| AI Generation | `UploadBlock(references) → ProductionBlock(ai-gen) → ApprovalRound → DeliveryBlock` |
| Post-production Retainer | `UploadBlock(offline-edit) → ProductionBlock(grading) → ApprovalRound → DeliveryBlock` |

### Mid-flight mutation

Producer can at any time:

- **Insert a block** — "client wants an extra VFX round" → insert ProductionBlock(vfx) after current position
- **Remove a block** — "client skipped approval, just deliver" → remove ApprovalRound
- **Duplicate a block** — "we need 3 rounds of edit, not 1" → duplicate ProductionBlock(edit) twice
- **Reorder** — "grade before VFX this time" → drag to reorder (only uncompleted blocks)
- **Reassign** — change assigned user without touching sequence

Completed blocks are immutable. Any structural mutation posts to the activity feed with before/after diff.

---

## Data model

### Firestore collections

```
projects/{pid}
  // existing fields untouched
  id, name, clientId, type, createdAt, createdBy, deadline, ...

  // new workflow fields
  templateId: string                     // source template (for audit; blocks are the source of truth)
  templateType: string                   // 'photoshoot' | 'ad-film-full' | 'custom' | etc.
  currentBlockId: string | null          // pointer to the active block; null = all done
  revisionLimit: number                  // default 3
  deliverables: [
    { id, name, type: 'image'|'video'|'other', qty, fulfilledCount, notes }
  ]
  teamMembers: [                         // denormalized for quick access rules
    { userId, role, addedAt, removedAt }
  ]
  photographerUploadToken: string | null // public token for photographer upload link
  activityCount: number                  // denormalized for project list badges

projects/{pid}/blocks/{bid}
  id
  order: number                          // position in sequence
  type: 'UploadBlock' | 'SelectionRound' | ...
  variant: string | null
  label: string                          // editable display name
  status: 'locked' | 'pending' | 'in-progress' | 'done' | 'skipped'
  assignedRole: 'producer' | 'client' | 'editor' | 'colorist' | 'vfx' | 'audio' | 'music' | 'agency'
  assignedUserId: string | null          // null = any user with role can claim
  dueDate: timestamp | null
  slaHours: number                       // SLA duration in hours
  startedAt: timestamp | null
  completedAt: timestamp | null
  completedBy: string | null
  config: object                         // block-specific config (ratingSystems, pickCount, etc.)
  inputBlockIds: [bid]                   // which blocks' outputs feed this one
  // UI / workflow hooks resolved from type at runtime (not stored)

projects/{pid}/assets/{aid}
  // existing fields
  id, name, url, thumbUrl, rating, colorLabel, isSelected, ...

  // new fields
  blockId: string                        // which block this asset belongs to
  version: number                        // 1, 2, 3
  parentAssetId: string | null           // previous version in lineage
  watermarked: boolean
  watermarkText: string | null           // "Selection • 21 Apr 2026"
  hiResUrl: string | null                // separate from thumbUrl, gated
  hiResLocked: boolean                   // if true, download hidden until producer releases
  smartName: string                      // auto-generated "PEP-MERCH-2026-H001.jpg"
  metadata: {
    // photo
    width, height, exifFocal, exifAperture, exifShutter, exifIso,
    // video
    duration, codec, fps, audioCodec,
    // supers
    fontsUsed: [string], fontSizes: [number], isBrandFont: boolean,
    // generic
    sizeBytes, mimeType
  }

projects/{pid}/references/{rid}
  id, name, type: 'logo' | 'disclaimer' | 'cgi' | 'stock' | 'font' | 'brief' | 'other'
  url, thumbUrl, uploadedBy, uploadedAt, notes
  pinnedToAssetIds: [aid]                // many-to-many; also duplicated on asset for query speed

projects/{pid}/activity/{eid}
  id, type: 'block.started' | 'block.completed' | 'selection.submitted' | 'approval.requested' | ...
  actorId, timestamp
  payload: object                        // type-specific
  mentions: [userId]                     // for @mentions notification fanout
  threadId: string | null                // if this is a reply

projects/{pid}/selections/{sid}
  id, blockId, createdAt, createdBy
  assetSnapshot: [
    { assetId, rating, colorLabel, note, isFinalPick: bool }
  ]
  submitted: boolean                     // true once client clicks Submit Selection
  note: string                           // optional client message

projects/{pid}/assetRequests/{rqid}
  id, createdAt, requestedBy (editorId), description, urgency: 'low'|'med'|'high'
  requestFrom: 'client' | 'producer-assets' | 'external-vendor'
  status: 'pending-producer' | 'producer-approved' | 'rejected' | 'fulfilled'
  producerApprovedBy, producerApprovedAt, rejectionReason
  fulfilledAssetIds: [aid]
  fulfilledAt

projects/{pid}/revisionRounds/{rnid}
  id, blockId, roundNumber, maxRounds
  status: 'active' | 'completed' | 'extra-requested' | 'extra-approved' | 'extra-rejected'
  extraCost: number | null
  extraRequestedBy, extraApprovedBy

projects/{pid}/annotations/{anid}
  id, assetId, blockId, createdBy, createdAt
  shape: 'rect' | 'circle' | 'arrow' | 'freehand'
  coords: object
  comment: string
  resolved: boolean

workflowTemplates/{tid}
  id, name, description, icon, color
  isSystemDefault: boolean               // true only for built-in Photoshoot; cannot be deleted
  isActive: boolean                      // archive without delete
  createdBy, createdAt, updatedAt
  blocks: [
    {
      tempId, order, type, variant, label,
      defaultRole, defaultSLAHours, defaultAssigneeLogic,
      config: { ... }
    }
  ]

users/{uid}
  // existing + new:
  inboxPreferences: { emailDigest: 'off'|'daily'|'realtime', soundAlerts: bool }
  calendarIntegration: { googleCalId, appleCalUrl }
```

### Computed views (no storage)

- **Inbox per user** — `collectionGroup('blocks').where('status','in',['pending','in-progress']).where('assignedUserId','==',me)` plus OR-clause for role-match with null assignee, plus assetRequests where I'm the gate. Grouped client-side by: Overdue / Today / This Week / Later.
- **Project snapshot** — denormalized from blocks + activity + team + deliverables + references. One screen read.
- **Team workload** — `collectionGroup('blocks').where('assignedUserId','in',teamUids).where('status','in',['pending','in-progress'])` aggregated by user.

---

## Notification & inbox engine

### Rules table (source of truth for transitions)

Each block type defines `onEnter`, `onExit`, and optional `onTimeout` hooks. These are pure functions over `(project, block, actor)` that emit:
- `notifications` — to specific users
- `emails` — via `/api/send-email` with new template types
- `inboxUpdates` — upsert inbox items
- `activityEvents` — post to feed
- `stateMutations` — e.g., advance `currentBlockId`, increment revision round

```js
// lib/workflow/rules.js (new file)

export const BLOCK_RULES = {
  UploadBlock: {
    onEnter: ({ block, project }) => ({
      notify: [{ role: block.assignedRole, msg: `Upload needed: ${block.label}` }],
      emails: [{ role: block.assignedRole, template: 'block.upload.requested', data: {...} }],
      activity: { type: 'block.started', payload: { blockId: block.id } },
    }),
    onExit: ({ block, project }) => ({
      activity: { type: 'block.completed', payload: { blockId: block.id } },
      advance: true,
    }),
  },

  SelectionRound: {
    onEnter: ({ block, project }) => ({
      notify: [{ role: 'client', msg: `Selection needed: ${project.name}` }],
      emails: [{ role: 'client', template: 'selection.requested', data: {...} }],
      activity: { type: 'selection.requested' },
      setSLAReminders: [
        { atHour: block.slaHours * 0.75, template: 'selection.reminder' },
        { atHour: block.slaHours, template: 'selection.overdue', escalate: true },
      ],
    }),
    onClientSubmit: ({ block, project, snapshot }) => ({
      createSelectionSnapshot: snapshot,
      notify: [{ role: 'producer', msg: `Client submitted ${snapshot.finalPickCount} picks` }],
      emails: [{ role: 'producer', template: 'selection.submitted', data: {...} }],
      activity: { type: 'selection.submitted', payload: { selectionId: snapshot.id } },
      advance: true,
    }),
  },

  ApprovalRound: {
    onEnter: ({ block, project }) => ({
      notify: [{ role: block.assignedRole, msg: `Review needed: ${block.label}` }],
      emails: [{ role: block.assignedRole, template: 'approval.requested', data: {...} }],
      setSLAReminders: [...],
    }),
    onClientAction: ({ block, action, corrections }) => {
      if (action === 'approve') return {
        notify: [{ role: 'producer', msg: 'Approved!' }, { role: 'editor', msg: 'Approved!' }],
        emails: [...],
        activity: { type: 'approval.granted' },
        advance: true,
      };
      if (action === 'correct') return {
        notify: [{ role: 'editor', msg: `${corrections.length} corrections requested` }],
        emails: [...],
        activity: { type: 'approval.corrections.requested' },
        incrementRevisionRound: block.id,
        // check if round > limit → trigger extraRoundFlow
        checkRoundLimit: block.id,
      };
      if (action === 'pick-one') return { ... };  // for pick-one-of-many mode
    },
  },

  ProductionBlock: {
    onEnter: ...,
    onNewVersionUpload: ({ block, asset }) => ({
      incrementAssetVersion: asset.id,
      notify: [{ role: 'producer', msg: `New version from ${actor.name}` }],
      // if block has followup ApprovalRound, don't advance yet - production is iterative
    }),
    onMarkComplete: ({ block }) => ({
      notify: [{ role: 'producer', msg: `${block.label} complete` }],
      emails: [...],
      activity: { type: 'production.completed' },
      advance: true,
    }),
  },

  AdaptBlock: {
    onEnter: ...,
    onAdaptChecked: ({ block, adaptId }) => ({ updateChecklist: adaptId }),
    onAllAdaptsDone: ({ block }) => ({ advance: true }),
  },

  DeliveryBlock: {
    onEnter: ({ block, project }) => ({
      releaseHiResForAssets: project.approvedAssetIds,
      notify: [{ role: 'client', msg: 'Your files are ready to download' }],
      emails: [{ role: 'client', template: 'delivery.ready' }],
    }),
  },

  Checkpoint: {
    onEnter: ({ block }) => ({
      notify: [{ role: 'producer', msg: `Checkpoint: ${block.label}` }],
    }),
    onProducerAdvance: ({ block }) => ({ advance: true, activity: {...} }),
  },

  Parallel: {
    onEnter: ({ block, childBlocks }) => ({
      unlockAllChildren: childBlocks,
    }),
    onChildComplete: ({ block, childBlockId, allChildrenDone }) => {
      if (allChildrenDone) return { advance: true };
      return {};  // wait
    },
  },
};
```

### SLA engine

Every block with `slaHours` set gets an expected-by timestamp (`startedAt + slaHours`). A scheduled function (or client-side check on inbox load) emits:
- **75% of SLA passed** → in-app reminder + email to assigned user
- **100% passed** → mark overdue (visible in red in inbox), email producer
- **150% passed** → auto-escalate (email secondary contact, flag in producer dashboard)

For Phase 1, we use client-side scheduling (hourly Firestore Function OR on inbox load) rather than a background cron. Simpler.

### Email templates to add

Extend `app/api/send-email/route.js` with new types:

- `selection.requested` — client receives "Your selection is ready to review"
- `selection.reminder` — 75% SLA
- `selection.overdue` — 100% SLA
- `selection.submitted` — producer receives "Client submitted N picks"
- `approval.requested` — client / agency receives "Review needed"
- `approval.granted` — producer + editor receive "Client approved"
- `approval.corrections.requested` — editor receives "N corrections"
- `approval.round-limit-hit` — producer receives "Client wants round 4 of 3, approve extra charge?"
- `production.completed` — producer receives "Editor marked complete"
- `delivery.ready` — client receives "Your files are ready"
- `asset-request.created` — producer receives "Editor needs files"
- `asset-request.approved` — client receives "Editor needs these from you"
- `asset-request.fulfilled` — editor receives "Files arrived"
- `photographer.upload-invite` — photographer receives magic link
- `mention` — @mentioned user receives activity notification

### Inbox UI

Single page route: `app/inbox/page.js` — also embedded as a dashboard widget. Structure:

```
┌─ Inbox ────────────────────────────────────────┐
│                                                  │
│ Overdue (2)                                      │
│   🔴 Pepsi Merch — Selection        -1 day      │
│   🔴 Cheetos Campaign — Approval    -3 hours    │
│                                                  │
│ Today (3)                                        │
│   🟠 7Up Launch — Edit V2          due 5 PM    │
│   🟠 Nimbooz Social — Approval     due 9 PM    │
│   🟠 AssetRequest: Pepsi brand font           │
│                                                  │
│ This Week (4) ...                                │
│ Later (6) ...                                    │
│ Waiting On Others (3) [collapsed]                │
└──────────────────────────────────────────────────┘
```

Each item → click → jumps straight to the block's action UI (selection, review, upload, etc.). One-click from inbox to action.

---

## Feature specs

### 1. Selection Round block

**Client UI:**
- Full-screen grid, minimal chrome. No status badges. No version info. No R1/3. No feedback panel.
- Top bar: `[Project Name] · [N of M rated] · [Submit Selection →]`
- Filter pills: `All · ★1+ · ★2+ · ★3+ · ★5 · 🔴 · 🟡 · 🟢 · 🔵 · 🟣 · 🟠 · ⚪`
- Each card: image + 5-star control + color label dot + isSelected checkbox
- Tap image → full-screen lightbox
- **Lightbox:** arrow nav, `1-5` rate, `P/M/G/B/V/O/U` color labels (pick/maybe/green/blue/violet/orange/clear), `S` select, `F` fullscreen
- **Mobile mode:** card-stack swipe (swipe right = ★ up, swipe left = skip to next, long-press = color menu). Tap card = detail view.
- **Compare:** multi-select 2-4 via checkbox → "Compare" button → side-by-side (existing `ComparePanel.js`)
- **Snapshots:** clicking the "history" icon shows previous submissions — client can jump back to any snapshot and restore picks
- **Submit:** big CTA "Submit Selection" → confirmation modal ("You've picked N of M. Producer will be notified.") → creates snapshot → advances block

**Producer UI** (on the same block, different role):
- Read-only view of the client's current picks
- Ability to see which assets are selected vs rated vs unrated
- Can force-advance ("override: Submit Selection for client") — rarely used

### 2. Approval Round block

**Two modes:**

**Mode A — correction-or-approve** (default):
- Client sees a grid of current-version assets
- Clicking opens lightbox with: zoom, annotation tools, comment input
- Bottom bar: `[← Prev] [Request Corrections] [Approve ✓] [Next →]`
- If Request Corrections → all annotations + comments bundled into a "corrections package" → editor's inbox
- If Approve → asset marked approved, moves to approved bucket

**Mode B — pick-one-of-many** (for supers, variants):
- Grid shows N options (e.g., 3 super text designs)
- Radio-select UI, one must be picked
- "Submit Choice" → chosen option goes to editor

### 3. Production Block

**Editor UI:**
- Top section: current version of asset to edit (v1 from selection, etc.)
- Right panel: **Brief** — annotations + corrections + pinned references + client notes
- Bottom: "Upload New Version" button
- Can request assets from client via sidebar button (creates AssetRequest)
- Click "Mark Complete" when all selected assets have at least one new version uploaded → block advances

**Producer view:**
- Same as editor but with ability to reassign, add another editor, nudge

### 4. Adapt Block

**Editor UI:**
- Checklist view: for each approved master, a row with required adapts (1:1, 9:16, 4:5, etc.)
- Each cell: "Upload" button → uploads adapt → green check
- Block advances only when all checkboxes green
- Producer can add/remove required adapts per asset

### 5. Delivery Block

**Client UI:**
- Grid of all deliverables (master + adapts, grouped)
- "Download All (ZIP)" button — triggers server-side bundle
- Individual download per asset
- Re-download log visible to producer

**Hi-res gate:** when DeliveryBlock enters, system flips `hiResLocked=false` on approved assets. Until then, clients only see watermarked low-res (`watermarked=true`, `watermarkText='Stage: Approval · 21 Apr 2026'`).

### 6. Activity Feed

**Per project — right-rail drawer toggle.**

- Infinite scroll of events
- Filter by type (uploads, approvals, corrections, comments, mentions)
- Rich event cards with avatars, thumbnails, timestamps
- Reply button → posts a comment in thread
- @mention parsing — typing `@Ra` autocompletes team members
- @mentions fire email + in-app notification

### 7. Deliverables Checklist

**Project creation step:**
- Producer defines expected deliverables
- Each row: `name` + `type` + `qty` (e.g., "Hero shots · image · 5")
- Rows: "Hero shots / Product shots / Lifestyle / Social cutdowns / BTS / ..."
- Saved to `projects.deliverables[]`

**Project snapshot:**
- Progress bar per row: "Hero shots: 3 of 5 delivered"
- Auto-counts from assets marked `status=approved` within the project tagged to that deliverable

**Delivery block blocks completion** until all rows are fulfilled or producer explicitly overrides with reason.

### 8. Team Workload Dashboard

**Producer-only view: `app/team-workload/page.js`**

```
Ravi    [##########........] 10 blocks active · 3 overdue  · 25h pending
Priya   [##....] 2 blocks active · 0 overdue
Amit    [######........] 6 blocks active · 1 overdue
...
```

- Click user → modal with their full block list, jump-to-block
- Hover on bar → breakdown by project
- Sort by load, overdue, project count

### 9. Watermarked Previews

On upload to Storage, a Cloud Function (or client-side canvas before upload for Phase 1) generates a watermarked version:
- Original → `employees/../hi-res/original.jpg` (gated)
- Watermarked → `employees/../preview/watermarked.jpg` (shown in UI)

Watermark text: `"{ProjectName} · Stage: {currentStage} · {date}"` · faint, tiled, bottom-right.

Implementation Phase 1: **client-side canvas watermark** on upload — no Cloud Function needed. Both versions uploaded to Storage.

### 10. Smart File Naming

On upload, the original filename is preserved in `originalName` but a computed `smartName` is generated:
```
{PROJECT_CODE}-{BLOCK_TYPE_ABBR}-{SEQ:03d}.{ext}
PEP-MERCH-2026-SEL-001.jpg
PEP-MERCH-2026-EDIT-V2-001.jpg
```

Project code = first letters of project name + year, auto-generated with override.

### 11. Calendar Sync

- Project settings: "Sync to calendar" toggle
- Google: OAuth flow, creates events in user's Google Calendar for every block's due date
- Apple: generate `.ics` feed URL the user subscribes to
- Phase 1: .ics feed only (easier; no OAuth). Google via subscribe-to-URL.

### 12. Resumable Uploads

- Use Firebase Storage `uploadBytesResumable` (already used in `app/vendor/invoice/page.js:97-113`)
- Persist upload state to `sessionStorage` — on reload, offer "Resume upload" for any incomplete uploads
- UI shows per-file progress, failed retries with exponential backoff

### 13. Photographer Upload Link

- Producer clicks "Get Photographer Upload Link" on an `UploadBlock(raws)`
- System generates a signed token, stores in `projects.photographerUploadToken`
- Public route: `app/photographer-upload/[token]/page.js`
- No auth required, scoped to one project's raws block
- Drag-drop many files, resumable uploads
- Expires after block advances

### 14. AssetRequest flow

**Editor side:**
```
Inside any ProductionBlock, sidebar → "Request from Client"
  → form: { description, urgency }
  → submit → status: 'pending-producer'
  → in-app toast: "Sent to producer for review"
```

**Producer side:**
```
Inbox item: "Ravi needs Pepsi brand fonts"
  → open → see editor's request
  → [Approve & Forward to Client] / [Reject with reason]
  → approved → status: 'producer-approved', email sent to client
```

**Client side:**
```
Email: "The editor needs: Pepsi brand fonts"
  → click link → lands on a scoped upload page
  → uploads files
  → status: 'fulfilled', files added to project references, editor notified
```

### 15. References Pinning

- Project has `References` section in snapshot
- Producer uploads via drag-drop or file picker
- Each reference: thumb, name, type tag
- To pin: open an asset in editor context → sidebar "Pin Reference" → select reference → optional note ("Apply this logo to top-right corner")
- Editor sees pinned references inline when editing that asset

### 16. Revision Round Limits

- Project-level setting: `revisionLimit` (default 3)
- Each ApprovalRound block keeps its own round counter via `revisionRounds` subcollection
- When editor uploads and client triggers a new correction cycle, round++
- On `round > limit`:
  - Block pauses
  - Producer notified: "Client requests round 4 of 3. Extra charge?"
  - Producer can: reject (close block, deliver current), approve (with extra-cost note), request client confirmation
  - Client sees the extra-cost notice and confirms or cancels
  - All logged to `revisionRounds` for audit

---

## UI surfaces

### Primary surfaces (new or major rework)

1. **Inbox** — `app/inbox/page.js` + dashboard widget
2. **Project Snapshot** — replaces current project assets tab top view
3. **Stage Timeline Bar** — horizontal pill strip at top of project
4. **Selection Round UI (client)** — simplified grid, mobile-first swipe
5. **Approval Round UI (client)** — annotation + approve/correct
6. **Production Block UI (editor)** — brief + upload
7. **Adapt Block UI (editor)** — checklist grid
8. **Delivery Block UI (client)** — clean download hub
9. **Activity Feed drawer** — right rail on every project
10. **Deliverables Checklist** — project creation modal step + snapshot progress
11. **Team Workload Dashboard** — producer-only page
12. **Workflow Template Editor** — Settings → Templates
13. **Photographer Upload (public)** — scoped no-auth route
14. **AssetRequest producer review panel** — inside inbox
15. **Project settings: revision limit, SLA, calendar sync**

### Existing surfaces (light changes)

- **Share view (`app/share/[token]/page.js`)** — integrates block-aware UI (client's token now carries block access, not just project access). Clients land on whichever block they're assigned to (Selection, Approval, Delivery).
- **MainApp.js project tab** — gains stage timeline bar, snapshot view, block-routed sub-UIs.
- **Lightbox** — unchanged; keyboard shortcuts extended for color labels and rating already done in earlier work.

---

## Access control

| Role | Inbox | Project List | Snapshot | Blocks (own role) | Blocks (other roles) | Workflow Templates | Team Workload |
|---|---|---|---|---|---|---|---|
| Producer | Yes (all) | All projects | Full | Act | Read + force-advance | Edit | Yes |
| Editor | Own assigned | Projects with own blocks | Full | Act on assigned | Read (if on project) | Read-only | No |
| Client | Own client projects | Own projects | Client view (no workload) | Act on client blocks | Hidden | No | No |
| Agency | Own agency projects | Own projects | Client view | Act on approval blocks | Hidden | No | No |
| Photographer (via link) | No inbox | None | No | Upload only on scoped block | No | No | No |

**Client view of snapshot** hides: team workload, other projects, revenue data, budget, cost. Shows: their project stage, what's pending FROM them, activity feed of what's happened so far, deliverables progress.

---

## Phased implementation plan

Phase 1 ships in vertical slices, each independently testable. Order is chosen to minimize "we built it but can't see it work yet":

### Slice A — Data layer + admin tooling

A1. Firestore helpers for blocks, templates, activity, selections, revisionRounds, assetRequests
A2. Seed Photoshoot template into `workflowTemplates/`
A3. Workflow Template Editor UI (Settings page)
A4. Block rules table (`lib/workflow/rules.js`) with all block types' onEnter/onExit
A5. Activity posting helper
A6. Email template route extensions

**Verification:** seed template visible, can create + edit templates via UI, helpers round-trip correctly.

### Slice B — Project creation from template

B1. Extend project creation modal with "Choose Template" step
B2. Deliverables checklist step
B3. On create: materialize template.blocks into projects/{pid}/blocks
B4. Set `currentBlockId` to first block
B5. Fire first block's onEnter (notify + email + activity post)

**Verification:** create a project from Photoshoot template → project opens with blocks subcollection populated → first block pending → client gets email.

### Slice C — Stage timeline + project snapshot

C1. Stage Timeline Bar component
C2. Project Snapshot top section
C3. Deliverables progress tracker
C4. Activity feed drawer

**Verification:** project view shows timeline bar, snapshot, deliverables, activity. Works for existing (pre-block) projects too via graceful degradation.

### Slice D — Upload blocks

D1. UploadBlock UI (producer side, inline drag-drop)
D2. Resumable upload integration
D3. Smart file naming
D4. Client-side watermark generation (canvas, stage+date)
D5. Photographer upload public route
D6. Email: photographer.upload-invite
D7. `onComplete` → advance to next block

**Verification:** raws uploaded → watermarked previews shown → hi-res gated → next block unlocks.

### Slice E — Selection Round (the big one)

E1. Simplified grid UI for client (no status/version/feedback clutter)
E2. Filter pills (stars + colors + selected)
E3. Color label extension (7 colors, not 3 — extend existing work)
E4. Mobile swipe UI
E5. Snapshot on Submit Selection
E6. Email: selection.submitted
E7. Export Selections CSV button (producer side)

**Verification:** client rates 500 images → submits → snapshot persisted → producer notified → CSV downloadable.

### Slice F — Production + Approval blocks

F1. ProductionBlock UI (editor side) with brief panel
F2. References pinning
F3. Version upload ladder (V2 parent → V1)
F4. ApprovalRound UI (client side, correction mode)
F5. Annotations on approval
F6. Revision round counter + extra-round flow
F7. ApprovalRound pick-one-of-many mode (for supers)

**Verification:** editor sees brief → uploads V2 → client reviews → annotations → either approves or triggers round++.

### Slice G — Adapt + Delivery

G1. AdaptBlock checklist UI
G2. DeliveryBlock UI
G3. Hi-res unlock on entering Delivery
G4. Bulk ZIP download
G5. Deliverables checklist validation before delivery completion

**Verification:** full Photoshoot end-to-end: upload → select → edit → approve → adapt → deliver.

### Slice H — Inbox + notifications

H1. Inbox page (`app/inbox/page.js`)
H2. Dashboard inbox widget
H3. Overdue / Today / This Week grouping
H4. Email digest (daily summary) — optional
H5. SLA timer checks on inbox load (Phase 1) or Cloud Function (Phase 2)
H6. @mention autocomplete in activity feed
H7. In-app notification toasts

**Verification:** Harnesh's inbox shows blocks across all 5 projects, click-through works, emails fire on transitions, SLA reminders fire.

### Slice I — AssetRequest side-channel

I1. "Request from Client" button inside ProductionBlock
I2. Producer review panel (inside inbox)
I3. Client scoped upload page
I4. Email chain (pending → approved → fulfilled)

**Verification:** editor requests Pepsi font → producer approves → client uploads → editor sees it in brief.

### Slice J — Team workload + calendar

J1. Team Workload Dashboard page
J2. Per-user breakdown modal
J3. Calendar .ics feed endpoint
J4. User settings: calendar integration

**Verification:** producer sees load balance across team; subscribe calendar shows all deadlines.

### Slice K — Polish pass

K1. Click-outside-to-close on all modals (audit pass)
K2. Button size consistency (audit pass)
K3. Mobile breakpoint fixes across all new surfaces
K4. Empty states for every new view
K5. Loading states (skeleton screens for slow queries)
K6. Error states with clear recovery paths
K7. Tooltips on all icon-only buttons

**Verification:** full QA pass, nothing feels "off."

---

## Verification (acceptance criteria)

### End-to-end Photoshoot test

1. Producer creates "Pepsi Merch Shoot" from Photoshoot template, defines deliverables (5 hero, 20 product, 10 lifestyle)
2. Producer shares photographer upload link with external shooter
3. Shooter uploads 200 RAWs (low-res JPEGs) via public link — resumable, watermarked previews generated
4. SelectionRound block enters — client receives email
5. Client logs in on phone, swipes through 200 images, stars some red/green, taps "Submit Selection"
6. Snapshot saved. Producer receives email + inbox item: "Client submitted 47 picks, assign editor."
7. Producer clicks inbox → Checkpoint block → assigns Ravi as editor → block advances
8. Ravi receives inbox item: "EditWork on 47 assets, due in 72h"
9. Ravi opens ProductionBlock, sees each asset with pinned brief references + annotations. Uploads V2 for each.
10. Ravi realizes he needs Pepsi brand font → clicks "Request from Client" → producer approves → client uploads → font appears in Ravi's references.
11. Ravi marks complete → ApprovalRound enters. Client gets email.
12. Client annotates 3 assets requesting corrections, approves the rest. Revision round becomes 2 of 3.
13. Ravi uploads V3 for 3 annotated assets.
14. Client approves all. Round ends.
15. AdaptBlock enters. Ravi uploads 1:1 + 9:16 + 4:5 for each of 47. All green-checked.
16. DeliveryBlock enters. Hi-res unlocked. Client downloads bulk ZIP. Producer sees download log.
17. Throughout: Activity feed captures every event. Inbox shows correct pending items per user. SLA reminders fire as configured.

### Role isolation tests

1. Client logged in sees ONLY: their inbox (own items), their projects (own projects only), simplified project snapshot (no team workload, no budget), SelectionRound/ApprovalRound/Delivery UIs appropriate to current block.
2. Editor logged in sees: own inbox (only their assigned blocks), own projects, ProductionBlock UI, cannot see other projects they're not on.
3. Producer sees everything.

### Template editor tests

1. Harnesh can duplicate Photoshoot template, rename to "Lifestyle Shoot", remove AdaptBlock, save → new template usable for new projects.
2. Harnesh can create a new template from scratch called "AI Generation" with 4 blocks → create project from it → blocks materialize correctly.
3. Harnesh cannot delete the system default Photoshoot template (archive only).

### Notification tests

1. Every block transition fires the correct email + in-app notification + activity post.
2. SLA reminders fire at 75% / 100% / 150%.
3. Revision round > limit triggers extra-charge flow correctly.
4. @mention in activity comment fires email + inbox item for mentioned user.

---

## Reuse / impact on existing code

**Reuse wherever possible:**
- `components/ComparePanel.js` — unchanged, used inside SelectionRound
- `lib/firestore.js` — extend with block/template helpers
- `app/api/send-email/route.js` — add new template types, existing Resend integration unchanged
- `app/vendor/invoice/page.js:97-113` — resumable upload pattern copied into uploads
- Existing share token system — extended with block-awareness
- `components/MainApp.js` Modal component (lines 423-460) — reused for all new modals
- Theme tokens unchanged

**Explicitly not touched in Phase 1:**
- HR module (from plan `distributed-twirling-dove.md`)
- Model releases system
- Vendor invoice system
- Team management page (other than workload dashboard overlay)

---

## Risks

| Risk | Mitigation |
|---|---|
| Scope too large for one push | Ship Slice A alone first, validate, then proceed. Each slice is independently testable. |
| Firestore `collectionGroup` limits hit at scale | Monitor. Switch to denormalized `user_inbox/{uid}/items/{bid}` cache later if needed. Phase 1 fine for <100 projects. |
| SLA cron not trivially available | Use client-side check on inbox load in Phase 1. Upgrade to Firebase Scheduled Functions in Phase 2. |
| Watermarking client-side slow for large files | Use a worker + canvas; fall back to server-side Cloud Function if slow. |
| Too many emails annoy clients | Add per-user notification preferences early. Email digest option (daily vs realtime). |
| Template editor complexity | Phase 1 ships with system Photoshoot only; editor is read-only-for-now + clone+edit only. Full creator UI Phase 2 if needed. Harnesh can request templates in Phase 1 and I'll seed them. |

---

## Appendix A — Block config schemas

```ts
UploadBlock.config = {
  variant: 'raws' | 'references' | 'offline-edit' | 'hi-res',
  allowPublicLink: boolean,
  acceptedMimeTypes: string[],     // e.g., ['image/jpeg','image/png']
  maxFileSizeMB: number,
}

SelectionRound.config = {
  ratingSystems: ('stars' | 'colors')[],
  colorLabels: string[],            // up to 7; names customizable
  allowSnapshots: boolean,
  allowCompare: boolean,
  mobileSwipe: boolean,
}

ProductionBlock.config = {
  specialty: 'edit' | 'grading' | 'vfx' | 'audio' | 'music' | 'supers' | 'ai-gen' | 'generic',
  allowAssetRequests: boolean,
  requireAllAssetsVersioned: boolean,  // true = can't mark complete until every selected has V2
}

ApprovalRound.config = {
  mode: 'correction-or-approve' | 'pick-one-of-many',
  pickCount: number | null,
  allowAnnotations: boolean,
  allowCorrectionsReturnToEditor: boolean,
}

AdaptBlock.config = {
  requiredAdapts: [{ name: '1:1', width: 1080, height: 1080 }, ...],
  allowCustomPerAsset: boolean,
}

DeliveryBlock.config = {
  allowBulkZip: boolean,
  unlockHiResOnEnter: boolean,
}

Checkpoint.config = {
  prompt: string,                   // e.g., "Confirm editor assignment"
  requiredActions: string[],        // e.g., ['assign-editor']
}

Parallel.config = {
  children: [BlockConfig, ...],     // N child block configs
}
```

---

## Appendix B — Photoshoot default template (seed)

```js
{
  id: 'tpl_photoshoot',
  name: 'Photoshoot',
  description: 'Standard photoshoot: upload → select → edit → approve → adapt → deliver',
  icon: 'camera',
  isSystemDefault: true,
  isActive: true,
  blocks: [
    { order: 1, type: 'UploadBlock', variant: 'raws', label: 'Upload Raws',
      defaultRole: 'producer', defaultSLAHours: 168,
      config: { allowPublicLink: true, acceptedMimeTypes: ['image/jpeg','image/png'] } },
    { order: 2, type: 'SelectionRound', label: 'Client Selection',
      defaultRole: 'client', defaultSLAHours: 72,
      config: { ratingSystems: ['stars','colors'], mobileSwipe: true, allowSnapshots: true, allowCompare: true } },
    { order: 3, type: 'Checkpoint', label: 'Assign Editor',
      defaultRole: 'producer', defaultSLAHours: 24,
      config: { prompt: 'Selection complete. Assign editor to proceed.', requiredActions: ['assign-editor'] } },
    { order: 4, type: 'ProductionBlock', variant: 'edit', label: 'Edit Work',
      defaultRole: 'editor', defaultSLAHours: 72,
      config: { specialty: 'edit', allowAssetRequests: true, requireAllAssetsVersioned: true } },
    { order: 5, type: 'ApprovalRound', label: 'Client Approval',
      defaultRole: 'client', defaultSLAHours: 48,
      config: { mode: 'correction-or-approve', allowAnnotations: true } },
    { order: 6, type: 'AdaptBlock', label: 'Adapts',
      defaultRole: 'editor', defaultSLAHours: 48,
      config: { requiredAdapts: [
        { name: 'Master', width: null, height: null },
        { name: '1:1', width: 1080, height: 1080 },
        { name: '9:16', width: 1080, height: 1920 },
        { name: '4:5', width: 1080, height: 1350 },
      ], allowCustomPerAsset: true } },
    { order: 7, type: 'DeliveryBlock', label: 'Delivery',
      defaultRole: 'client', defaultSLAHours: null,
      config: { allowBulkZip: true, unlockHiResOnEnter: true } },
  ],
}
```

---

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-21 | Stage = per-project (not per-folder or per-asset) | Harnesh confirmed. Simpler mental model. |
| 2026-04-21 | Templates = data (Firestore), not code | Harnesh wants to add workflows without a developer |
| 2026-04-21 | Phase 1 = Photoshoot only; other templates data-seedable later | Ship smallest usable scope |
| 2026-04-21 | Pre-production blocks deferred | App is post-shoot only |
| 2026-04-21 | Invoicing / budget / revenue dash deferred | Not Phase 1 priority |
| 2026-04-21 | AssetRequest = cross-cutting side-channel, not a block | Doesn't gate stage progression |
| 2026-04-21 | Supers = ApprovalRound pick-one-of-many mode, not new block | Reuse existing primitives |
| 2026-04-21 | Client-side watermark in Phase 1 (canvas) | Avoid Cloud Function complexity; swap later if slow |
| 2026-04-21 | SLA check on inbox load (Phase 1), not scheduled function | Simpler; upgrade later |

---

*End of design. Next: implementation plan via `writing-plans` skill.*
