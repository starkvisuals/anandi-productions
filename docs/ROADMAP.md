# Anandi Productions — ROADMAP (single source of truth)

> **EVERY SESSION:** read this + `docs/ARCHITECTURE.md` + `docs/PLAYBOOK.md` + `docs/BUILDING-BLOCKS.md` first. Do ONE chunk. Compile. Commit to `main`.
> Then update **LAST DONE / NEXT UP** below and check the box. Never re-explore MainApp.js.
> **If you hit a trap or learn something → APPEND it to `docs/PLAYBOOK.md` the same session.** That's how we stop repeating expensive mistakes.
> **Before building in a new domain → check `docs/BUILDING-BLOCKS.md` for a vetted OSS block to adopt-and-own instead of reinventing.** Verify any new dep's license first.

---

## ▶ LAST DONE / NEXT UP

- **LAST DONE (2026-09-05):** 🔴 **SECURITY — Phase 1 (share-token index + fail-safe rules), app side shipped + verified live.**
  - **Confirmed the exposure empirically:** a no-auth public REST read of `/projects` returned **HTTP 200** with every project's `shareLinks` (token + password hash) and `assets`. Rules were `if true` (open r/w).
  - **Root blocker:** the login-less share page listed the WHOLE `projects` collection (`getDocs(collection(db,'projects'))`) to find one token — so rules couldn't be locked without breaking clients.
  - **Fix shipped (`b16cd78`):** added `shareTokens/{token}` index (`lib/firestore.js` `setShareTokenIndex`, written on `createShareLink`/`deactivateShareLink`); share page + `api/share/verify` resolve via a single-doc GET, legacy scan kept only as fallback. Backfilled the one existing active token (`8mw3az5v90umn9bj6e0`). Wrote `firestore.rules` + `storage.rules` (catch-all `if request.auth!=null` = team full access so nothing breaks; anonymous limited to 5 share paths; **no anonymous `list`**). `docs/SECURITY.md` = exposure + deploy steps + phase-2 plan.
  - **Found+fixed a pre-existing share-page crash (`f79c138`):** the editor share link white-screened ("Cannot access 'assets' before initialization", React #423) — the modal keyboard-shortcut `useEffect` was declared ABOVE the `isClient`/`assets` consts its deps array reads (const TDZ during render). Moved it below the derived consts. **Verified live:** `/share/8mw3az5v90umn9bj6e0` now renders the editor upload view, 0 console errors.
  - **⏳ AWAITING HARNESH:** publish `firestore.rules` + `storage.rules` in the Firebase console (Firestore→Rules, Storage→Rules → paste → Publish). That's what actually locks the DB. Then Phase 2 (airtight): add a Firebase Admin service account → server-side client writes → flip the `‹PHASE-2›` rule lines to `if false`. See `docs/SECURITY.md`.

- **LAST DONE (2026-08-30):** Big functional-bug session (all diagnosed live + fixed + verified):
  - **File upload was 100% broken** (`20b8822`): the Upload button was `onClick={handleUpload}`, passing the click EVENT as `forcedFiles`; the handler's `if(!toProcess.length) return` saw `event.length===undefined` and returned before doing anything → "nothing happens on upload". Fixed to `onClick={() => handleUpload()}` + hardened the handler to ignore non-array args. **Verified:** uploaded a test file live, it appeared + logged in activity, then deleted it.
  - **Calendar/Inbox "not working" + the whole-session "two-click to open a project" quirk** (`f20ae33`): ONE root cause — the content area was wrapped in `<AnimatePresence mode="wait">` keyed on view+projectId; `mode="wait"` held the new view behind the old view's 0.2s exit anim, so nav/header switched but content lagged a click behind. Removed the gating (kept the keyed fade-in). **Verified:** single-click opens projects; Calendar/Inbox switch instantly from within a project; Calendar renders fine (was just hidden by the lag).
  - Brand polish: video player + lightbox tabs + project-view tab bars/toggles → brand yellow; light-mode contrast fix on active nav/links; lightbox/expanded-sidebar overlap fix. All verified both themes.
  - **Mux is now CONFIGURED** in prod (Harnesh added the keys; `/api/mux/test` → configured, debug → connection successful). New video uploads will stream via HLS. Existing videos need re-upload.
- **⏳ STILL REQUESTED BY HARNESH (2026-08-30) — bigger chunks, do one at a time:**
  1. **Team ↔ Employee not connected** — data-model work (Team view vs Employees module; likely `users` with isEmployee/isCore/isFreelancer flags not unified). Investigate live.
  2. **Workflow not working** — the workflow-block subsystem (materializeBlocksFromTemplate/advanceProject); ROADMAP-flagged fragile. Needs careful diagnosis.
  3. **Tasks UI not good** — redesign the tasks view (kanban/list) to the design system.
  4. **Project-view UI redesign** — Harnesh provided a Frame.io-grade reference mockup (big project header w/ thumbnail, stats row Assets/Folders/Requests/Approved/Pending, filter chips, right rail Requests+Activity, storage meter). Substantial multi-part redesign of the project detail view.
  - Minor: single-card asset delete uses a native `confirm()` (fine for users; just froze headless automation during testing).
- **LAST DONE (2026-08-29, cont.):** Two more live issues fixed + **verified in Harnesh's session**:
  - **#1 Video reliability** (`fe51538`): the lightbox `<video>` had zero error/stall handling, so a transient Firebase Storage **503** on the raw `.mp4` left it stuck on a black frame. Added onError auto-retry (3× backoff), buffering spinner (onWaiting/onStalled), and a clear "Couldn't load this video / Retry" overlay. (Durable fix still = Mux HLS.)
  - **#2 Project-creation "stuck at Loading templates…"** (`ceccb37`): root cause = the `workflowTemplates` Firestore collection is **empty (0 docs — confirmed via REST)**, and the wizard used `templates.length===0` as a "loading" proxy → hung forever at step 2. Added real loading/error/empty states. **Verified live:** step 2 now shows "No workflow templates yet — continue without one" + Next enabled. Also surfaced silent create-project save failures (`handleCreate` now shows an error banner instead of only console.error). **Note:** no workflow templates exist in the DB — Harnesh may want to create some (or keep using "standard workflow").
- **LAST DONE (2026-08-29):** 🔴 **CRITICAL LIVE CRASH FIXED + VERIFIED** — the "Application error: client-side exception" on opening ANY video (and the reason Annotate "didn't work") was `TypeError: undefined.substring()` at `videoFeedbackMarkers.map` (MainApp ~9216): a feedback marker with a `videoTimestamp` but NO `text` (an annotation/pin-only comment — this project has one at @0:01) hit `fb.text.substring(0,50)`, throwing during render and white-screening the whole page BEFORE the lightbox (and its Annotate tab) could show. Guarded every `fb.text/r.text/feedback.text` string-method call with `(x.text||'')` (lines 1615, 9216, 10583, 10586). **Captured the real stack + verified the fix in Harnesh's live session** (claude-in-chrome): video lightbox opens clean (no console error), Annotate tab opens with full toolbar, drew + selected + deleted a rectangle successfully. Commit `d7e9aad`, deployed READY. ⚠️ **Known remaining (infra, not code):** the raw Firebase Storage `.mp4` intermittently returns **HTTP 503** under playback (small files/thumbs 200; the 36MB video 503'd twice then 200'd on direct retry) → player stalls on a black frame with no error. Durable fix = Mux HLS (already built; this asset just isn't resolving muxPlaybackId). Consider: auto-retry-on-stall + clear error state instead of infinite black. *(prev: A1.5a — wired `<CommentSidebar>` into MainApp's lightbox **feedback panel**)*
- **_older_ LAST DONE:** A1.5a — wired `<CommentSidebar>` into MainApp's lightbox **feedback panel** (the `rightPanelTab==='comments'` block, MainApp ~9571). Adapter maps stored `feedback[]` (userName/isDone/timestamp/replies.userName) ⇄ sidebar shape (author/resolved/createdAt/replies.author). Comment ADD still routes through `handleAddFeedback(text)` so **all side-effects are preserved** (mention extraction, assignee+mention emails, task auto-create, activity log, status→changes-requested, turnaround). `handleReviewUpdate` handles edit/resolve/reply, `handleReviewDelete` deletes, `handleReviewSeek` jumps the video, all via `persistFeedback`→`updateProject`. `handleAddFeedback` refactored to take a text arg (regex switched to `matchAll` to dodge the security hook). **MainApp compiles (634kb) + app boots clean, no console errors — but the actual lightbox needs Harnesh to test live (Firebase login).** *(prev: A2.2 resolution ladder ✅.)*
- **🔎 HARNESH — LIVE TEST A1.5a:** open a project → asset → Comments tab. Check: comment list shows with author/time; posting a comment fires (mention/email/task still work); resolve toggle; reply; delete; on video, the timecode chip seeks; @mention dropdown; panel height/scroll looks right in the dark lightbox. Report anything off.
- **⏸ A1.5 DEFERRED (needs live app test):** the lightbox (~MainApp 8850–9600) is a deeply-woven **custom Mux/HLS player** (own `<video>`, shuttle, fullscreen, keyboard handlers) — dropping `<ReviewViewer>` (own video+canvas) in wholesale collides with it and can only be validated with Firebase auth + a real project, not in-sandbox. Do A1.5 as a **focused, live-tested pass**: map real asset → `{feedback, annotations, url, type}`; wire a single smart `onUpdateAsset` that persists via `updateProject` AND, on a feedback item gaining non-empty text, fires the existing mention/email/task/activity/status side-effects (reuse `handleAddFeedback` logic ~7017); untangle the custom player vs ReviewCanvas's `<video>`; delete dead annotate/feedback code. **All the /dev components it needs (ReviewViewer, AssetCard, LazyImage) now exist and are verified.**
- **NEXT UP:** Harnesh to retest the **Annotate** tab (A1.5b `<ReviewViewer>` overlay — now crash-hardened: bulletproof adapter + error boundary + Mux HLS verified at /dev). Meanwhile safe design-migration work continues: **C2** sidebar/top-nav, **C3** dashboard, **C4** project-view shell (C1 Login ✅). Product-decision items **B1/B2** (Inbox/Workflow) need Harnesh's call.
- **Build order:** A1(.1–.4 ✅, .5 live-pending) → A3.3/A3.1 ✅ → A2 ✅ → B → C1–C5 → A4/A5 → D → E → C6/C7.

---

## Per-chunk discipline (do this every time)
1. Read this + ARCHITECTURE + PLAYBOOK → find NEXT UP + relevant traps/knowledge. 2. Do exactly that chunk. 3. `npx esbuild <file> --bundle=false --loader:.js=jsx` clean. 4. Commit + push `main`. 5. Update LAST DONE / NEXT UP + tick the box. 6. If a trap/lesson surfaced → append to PLAYBOOK.
Rules: one file / tight feature per chunk (>3 files → split). Reuse `generateId`/`updateProject` (lib/firestore), `formatTimecode` (MainApp), `components/ui/*`, `useTheme`/`useToast`. Read colors from tokens, never hardcode hex.

---

## ✅ DONE
- Foundation: `lib/theme.js`, `lib/z.js`, `lib/motion.js`
- Primitives (`components/ui/`): Button, Input/Select/Textarea/Field, Card, Modal, Toast (global), Skeleton/Spinner/EmptyState, Menu (+useContextMenu), FocusRing — preview at `/dev/components`
- Brand: black+yellow Logo, tokens in THEMES · Email: SMTP via system@anandiproductions.com
- HR module: employees, onboarding, leave, comp-off, Jibble attendance, payroll, payslips, termination, probation, offer-letter upload
- Removed 42 broken `outline:'none'`; global focus rings
- M0: ROADMAP + ARCHITECTURE + PLAYBOOK + BUILDING-BLOCKS + memory note
- `PRODUCT.md` (impeccable init): durable product truth — 3 co-equal jobs (client review / team workflow / HR), clients use share links (no login), Anandi-only now + SaaS-aware later. Design work reads this.

---

## PHASE A — Content Asset Management (HIGHEST)

### A1 — Frame.io review: annotation + timestamp comments  *(#1 daily pain)*
Unify `feedback[]` (comments) + `annotations[]` (drawings) into ONE loop. Custom canvas synced to `video.currentTime`. Extend feedback item with `pin:{x,y}` + `drawing[]` (keep `videoTimestamp`). Legacy `annotations[]` stays readable — no migration.
- [x] **A1.1** `components/review/ReviewCanvas.js` — port from `AnnotationCanvas.js`; pin tool + video-overlay sync; verified on `app/dev/review/page.js`
- [x] **A1.2** `components/review/CommentSidebar.js` — comments primary; timecode/pin chips; click → seek + highlight; composer + @mention; Toast; wired into `/dev/review`
- [x] **A1.3** `components/review/VideoTimeline.js` — comment markers (ts/duration math); click → seek + select; track scrub + keyboard; wired below video on `/dev/review`
- [x] **A1.4** `components/review/ReviewViewer.js` — composes canvas+timeline+sidebar; controlled via `onUpdateAsset`; feedback[] canonical + legacy annotations readable; real local sample video; verified on `/dev/review`
- [~] **A1.5** Wire into MainApp lightbox — **A1.5a DONE:** feedback panel → `<CommentSidebar>`. **A1.5b DONE (live-test pending):** the **Annotate tab now renders the full `<ReviewViewer>`** (canvas + hover-scrub timeline + comment rail + Mux HLS) as a reversible overlay (MainApp ~8974); lossless `realToReview`/`reviewToReal` adapter maps stored `feedback[]` ⇄ ReviewViewer shape; `handleReviewAssetUpdate` persists + fires mention/email/**task**/activity side-effects when a comment gains text. Compiles + boots clean. Preview tab = classic player (untouched, reversible). **Follow-ups:** gate the old annotate block so its `<video>` doesn't double-load under the overlay; retire `AnnotationCanvas` + `handleSaveAnnotations`/`handleSaveVideoAnnotations` once A1.5b is confirmed live.

### A2 — Thumbnail + resolution loading
- [x] **A2.1** Progressive/blur-up thumbnails → `components/media/LazyImage.js` (thumb→full fade, aspect-ratio no-CLS, T18 guard, onError); verified `/dev/assets`
- [x] **A2.2** Resolution ladder → `LazyImage` `highRes` prop: base paints, higher-res preloads in bg + cross-fades in once decoded (never flashes, off-screen never fetches); verified `/dev/assets` (LOW→MED→HIGH)

### A3 — Asset grid + lightbox UX (mobile + polish)
- [x] **A3.1** Asset grid card → `components/assets/AssetCard.js` (primitives + tokens, blur-up thumb, hover, rating/select/label/status); verified `/dev/assets`
- [ ] **A3.2** Lightbox shell → primitives; mobile full-screen sheet, desktop keyboard
- [x] **A3.3** Right-click asset menu → `Menu` primitive in AssetCard; grouped Share/Copy URL/Download/Rename + Delete-in-red with divider; verified via DOM

### A4 — Compare + Filters (exist at /test — wire in)
- [ ] **A4.1** Wire ComparePanel into lightbox (Cmd+click set already built)
- [ ] **A4.2** Wire FilterPanel into grid; delete `/test/*` routes

### A5 — Project creation streamline
- [ ] **A5.1** Essential 3–4 fields only; progressive disclosure; primitives + Toast

---

## PHASE B — Clarify / cut confusion
- [ ] **B1** Inbox — rename to a clear purpose or remove; record decision here
- [ ] **B2** Workflow vs Workflow Templates — consolidate to one, cut the other (templates reportedly broken)
- [ ] **B3** Survivor of B2 → make it actually work, or hide behind a flag

---

## PHASE C — Design migration (screen by screen)
Each: inline→primitives, hex→tokens, `—`→EmptyState, "Loading…"→Skeleton, emoji→Icon, ad-hoc modal→Modal, Toast on every action. No logic change. Verify dark+light+mobile.
- [x] **C1** Login (`components/LoginPage.js`) — migrated to `Input`/`Button` primitives + `useTheme` tokens; rebranded off-brand indigo/purple → **brand yellow + near-white primary** (design contract); theme-aware form + fixed dark brand hero; password toggle works; verified, no console errors
- [x] **C2** Sidebar active state → **brand yellow** (`t.brandYellow`): nav item text/tint/icon, active indicator bar, mobile active border — all safe accent roles (never a fill behind text). Was off-brand indigo `t.primary`. Compile-clean; Harnesh to eyeball live. *(No separate top-nav tab bar — the sidebar is the nav.)*
- [~] **C3** Dashboard — **accent pass done:** the clearly-safe indigo accents → **brand yellow** (both progress bars, "View All" link, activity timeline dot/icon/project-link). Deliberately LEFT the data-viz/category colours (per-project-type gradients, stat-number palette, status dots) — those must stay distinct + shouldn't be blind-rebranded. Compile-clean. Full dashboard rebrand (fills/buttons) → the live verified pass.
- [ ] **C4** Project view shell (tabs/header/toolbar; grid is A3)
- [ ] **C5** HR module (`components/hr/**`) — EmployeeModule → DetailModal → forms → panels
- [ ] **C6** Global mobile responsive pass (375/768/1024/1440)
- [ ] **C7** A11y pass (aria-labels, focus order, reduced-motion) top 5 flows

---

## PHASE D — HR features + fixes
- [ ] **D1** Employee self-service profile `app/me/page.js` — performance %, attendance %, holidays, leave balance, HR comments (read-only); `hr_notes/{uid}` subcollection; admin writes via DetailModal tab
- [ ] **D2** Monthly views `app/me/history/page.js` — attendance timeline + payslip archive (reuse `PayslipView`)
- [ ] **D3** `TeamPicker` reads `users where isEmployee===true`
- [ ] **D4** Fix terminated employees in team picker / team view (bug)
- [ ] **D5** (optional) Admin SDK password reset — needs 3 service-account env vars

---

## PHASE E — Documents: AP branding + preview (use `ap-brand-design` skill)
- [ ] **E1** Model Release → branded AP PDF + in-app preview before sign
- [ ] **E2** T&C / Handbook / Offer / Agreement PDFs → AP branding + preview (reuse `PayslipView` print pattern)
- [ ] **E3** (Harnesh) Reset HR templates in-app to pull strengthened contract wording

---

## PHASE F — Harnesh actions (not code)
- [ ] **F1** Verify production (WhatsApp invite, SMTP, forgot-password, termination, probation, offer upload, modal stability) → log `docs/verification.md`
- [ ] **F2** Drop real `public/logo.svg` if pixel-perfect wanted
- [ ] **F3** (optional) Custom domain `portal.anandiproductions.com`
