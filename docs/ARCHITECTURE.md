# Anandi Productions — Architecture Cheatsheet

> **READ THIS FIRST every session. Do NOT re-explore the 11k-line MainApp.js.**
> Line numbers drift as the file changes — grep the named symbol if a range looks off,
> then update the number here.

## Stack
Next.js 14 (app router) · Firebase (Auth + Firestore + Storage) · Vercel (auto-deploys `main`) · client-heavy, mostly inline-styled.

## The monolith: `components/MainApp.js` (~11,000 lines)
Everything except HR + a few extracted pieces lives here. Key anchors (grep the symbol to re-confirm):

| What | Symbol / area | ~line |
|---|---|---|
| Legacy theme map (dark+light) | `const THEMES = {` | 107 |
| Video thumbnail component | `const VideoThumbnail =` | 838 |
| Lightbox / selected asset state | `selectedAsset`, `assetTab`, `videoTime`, `videoRef` | ~5720–5830 |
| Mux/HLS setup | `muxPlaybackId` effect | ~5855 |
| Keyboard shortcuts (rating, frame-step, colour labels) | key handler effect | ~6020–6180 |
| **Add comment (feedback)** — captures `videoTimestamp` | `handleAddFeedback = async` | 7017 |
| Toggle done / reply | `handleToggleFeedbackDone`, `handleAddReply` | 7065, 7075 |
| **Save image annotations** | `handleSaveAnnotations = async` | 7088 |
| **Save video annotations** (fragile 0.5s match) | `handleSaveVideoAnnotations = async` | 7100 |
| Asset grid render | `stagger-children` grid | ~7877 |
| Lightbox render (preview / annotate / feedback panel) | `assetTab === 'annotate'`, feedback list | ~9140–9600 |
| Video timeline markers | `videoTimestamp / videoDuration * 100` | ~9017 |
| View router (dashboard/projects/inbox/employees…) | `view === '...'` | ~11030–11060 |

## Data model (Firestore)
- `projects/{id}` → `{ assets: [...], activityLog, shareLinks, assignedTeam, ... }`
- **asset** (inside `project.assets[]`): `{ id, name, type: 'image'|'video'|'audio'|'other', url, thumbnail, muxPlaybackId, rating, colorLabel, isSelected, status, currentVersion, versions[], annotations[], feedback[], ... }`
- **feedback item** (COMMENTS — the Frame.io primary object): `{ id, text, userId, userName, timestamp, isDone, replies[], mentions[], round, videoTimestamp: number|null }` → **A1 extends with** `pin:{x,y}|null`, `drawing:[]|null`
- **annotations item** (legacy drawings, %-coords): `{ id, type:'rect'|'circle'|'arrow'|'freehand'|'text', x, y, width, height, color, text, path?, videoTimestamp?, author, createdAt }`
- `users/{uid}` → base + HR fields (`isEmployee`, `employeeId`, `ctc`, `probation`, `employmentStatus`, `documents`, `signatures`, `compOffBalance`, …)
- HR collections: `hr_leave_requests`, `hr_attendance/{YYYY-MM}`, `hr_payroll/{YYYY-MM}`, `hr_pending_approvals`, `hr_audit_log`, `settings/hr`

## `lib/`
- `firestore.js` — `generateId`, `generateShareToken`, `createUser/getUser/updateUser`, `createProject/updateProject/getProject`, `createShareLink`, `getSettings/saveSettings`, `STATUS`, `TEAM_ROLES`
- `firebase.js` — app init, exports `auth`, `db`, `storage`, `firebaseConfig`
- `theme.js` — **design tokens** `TOKENS.dark/.light`, `ThemeProvider`, `useTheme()`, `SPACE/RADIUS/FONT/SIZE/WEIGHT/TOUCH_MIN`
- `z.js` — z-index scale (`Z.overlay/modal/popover/toast/tooltip`)
- `motion.js` — `MOTION` (duration/easing/transition), `useReducedMotion()`, `useMotion()`
- `hr.js` — all HR logic + guards (`canAccessHr`, `createEmployee`, `getLeaveBalance`, `terminateEmployee`, …)
- `attendance.js` — Jibble CSV parse + classify · `payroll.js` — monthly calc · `payslip.js` — payslip data + `rupeesInWords`
- `hrTemplates.js` / `hrRender.js` — contract/handbook/offer templates + `{{placeholder}}` render

## `components/ui/` — the primitive library (Phase 1, DONE). USE THESE, don't inline.
`Button` · `Input` `Select` `Textarea` `Field` · `Card` · `Modal` (+ `Modal.Footer`) · `Toast` (`ToastProvider` at root, `useToast()`) · `Feedback` (`Skeleton` `SkeletonRows` `Spinner` `LoadingPanel` `EmptyState` `EmptyValue`) · `Menu` (+ `useContextMenu`) · `FocusRing` (global, mounted in `app/layout.js`).
Preview: `/dev/components`. Contract: read colors/space/radius from `useTheme()`, never hardcode hex.

## `components/hr/` — HR module (DONE)
`EmployeeModule` (tabs: list/leave/attendance/payroll/approvals/settings) · `EmployeeDetailModal` · `AddEmployeeModal` · `ImportExistingUserModal` · `OnboardingFlow` · `LeaveManagementPanel` `LeaveRequestModal` · `AttendanceImport` · `PayrollSheet` · `PayslipView` · `HrSettingsView` · `PendingApprovalsPanel` · `WebcamCapture` · `SignaturePad`.

## `components/annotation/` — marker.js v3 wrappers (image only; being superseded by `components/review/` in A1)
`MarkerAnnotator.js`, `MarkerViewer.js`. `components/AnnotationCanvas.js` = the working %-coord drawing engine → **port into `components/review/ReviewCanvas.js`**.

## Test/dev routes
`/dev/components` (primitives) · `/test/annotate` `/test/filters` (to be folded into project view, then deleted) · `/dev/review` (A1, to be created).

## Layout / providers (`app/layout.js`)
`<ThemeProvider><FocusRing/><ToastProvider><AuthProvider>{children}` — theme + focus rings + toasts are global.

## Branding
Black + yellow. `#FACC15` = brand yellow (accent/focus ring only, never a fill behind text — WCAG). Primary button = black on light / near-white on dark. Design system: `docs/design-system.md`. Logo: `components/Logo.js`. Official doc branding: `ap-brand-design` skill.
