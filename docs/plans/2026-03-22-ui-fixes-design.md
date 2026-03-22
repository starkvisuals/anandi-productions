# UI Fixes & Improvements Design

## 1. Zoom — Fit-to-Container Default

Current: "100%" = native pixel size, so large images appear tiny in container.

Fix: Change zoom baseline. "Fit" = image fills container (object-fit: contain). This is default. Zoom percentages relative to fitted size:
- Fit (default) = fills available space
- 150% = 1.5x fitted size
- 200% = 2x fitted size (pixel inspection)
- 50% = thumbnail overview

Controls show: `- [Fit] + 150%` where Fit is reset button. Scroll wheel zooms. Double-click = 250% at click point.

## 2. Comment Area — Compact & Clean

Move comments into right sidebar panel below File Details. Collapse by default with header "Feedback (3)". Comment input always visible at sidebar bottom. Quick feedback buttons inline above input. Max 200px scrollable list.

## 3. Annotations — Floating Toolbar

Show floating toolbar on left edge when viewing image: pen, rectangle, text icons. Clicking any tool activates annotation mode directly (no tab switch). Annotate tab still works as secondary entry. Annotations show as colored overlays on preview.

## 4. Light Theme — Complete Pass

Systematic replacement of hardcoded dark colors in:
- Modal dialogs (new project, upload, share link)
- Kanban columns and cards
- Status badges and pills
- Toast notifications
- Bottom feedback bar
- Dropdown menus

Media preview area stays dark in both themes (standard for media apps).

## 5. Workflow — Staged Selection

Project-level `workflowMode`: photoshoot (staged), video (open), general (open).

Photoshoot stages:
| Stage | Actor | Available |
|-------|-------|-----------|
| Uploaded | Producer/Photographer | Grid, stars, color tags |
| Selection | Client | Selection toggle, stars. No comments |
| Selected | Editor | Full editing, upload retouched |
| Review | Client | Comments, annotations, approve/revise |
| Approved | Client | Download unlocks, asset locks |
| Delivered | Producer | Final state |

Video/general mode: comments always available (current behavior).

## 6. Asset Groups (Focus Stacking)

Select multiple images, click "Group" to create named group. Groups show as expandable sections in grid. Bulk operations on groups. Collapsible headers.

## 7. Asset Filters & Sorting

Filter bar between category tabs and asset grid:
`[Stars: All] [Status: All] [Tags: All] [Color: All] [Assigned: All] [Clear]`

Star filter: All, 5 only, 4+, 3+, 2+, 1+, Unrated
Status filter: multi-select chips
Tag filter: multi-select from predefined
Color tag: color dot clicks
Assigned: team member dropdown
Sort: Newest, Oldest, Rating high/low, Name A-Z

Active filters as removable pills below bar. Mobile: collapse to filter icon with slide-up panel.
