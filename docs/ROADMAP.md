# Anandi Productions — ROADMAP (single source of truth)

> **EVERY SESSION:** read this + `docs/ARCHITECTURE.md` + `docs/PLAYBOOK.md` + `docs/BUILDING-BLOCKS.md` first. Do ONE chunk. Compile. Commit to `main`.
> Then update **LAST DONE / NEXT UP** below and check the box. Never re-explore MainApp.js.
> **If you hit a trap or learn something → APPEND it to `docs/PLAYBOOK.md` the same session.** That's how we stop repeating expensive mistakes.
> **Before building in a new domain → check `docs/BUILDING-BLOCKS.md` for a vetted OSS block to adopt-and-own instead of reinventing.** Verify any new dep's license first.

---

## ▶ LAST DONE / NEXT UP

- **LAST DONE:** A2.2 — resolution ladder in `components/media/LazyImage.js`. New `highRes` prop: the base `src` paints first, the higher-res is preloaded in the background via `new Image()` and cross-fades in ON TOP only once fully decoded (never flashes; off-screen images never fetch it). Verified `/dev/assets` LOW→MED→HIGH (DOM: hi-res layer present, opacity 1, showing HIGH). ✅ *(prev: A2.1 blur-up LazyImage + A3.1 AssetCard + A3.3 right-click menu — all verified on `/dev/assets`, dark+light.)*
- **⏸ A1.5 DEFERRED (needs live app test):** the lightbox (~MainApp 8850–9600) is a deeply-woven **custom Mux/HLS player** (own `<video>`, shuttle, fullscreen, keyboard handlers) — dropping `<ReviewViewer>` (own video+canvas) in wholesale collides with it and can only be validated with Firebase auth + a real project, not in-sandbox. Do A1.5 as a **focused, live-tested pass**: map real asset → `{feedback, annotations, url, type}`; wire a single smart `onUpdateAsset` that persists via `updateProject` AND, on a feedback item gaining non-empty text, fires the existing mention/email/task/activity/status side-effects (reuse `handleAddFeedback` logic ~7017); untangle the custom player vs ReviewCanvas's `<video>`; delete dead annotate/feedback code. **All the /dev components it needs (ReviewViewer, AssetCard, LazyImage) now exist and are verified.**
- **NEXT UP:** **A1.5** live pass (biggest value — makes the whole review loop live in the app; needs Firebase testing — see the ⏸ note above), OR keep to safe `/dev`/component work: **A5.1** project-creation streamline, **C1** Login migration, **B1/B2** clarify Inbox/Workflow. The A-phase component library (ReviewViewer, AssetCard, LazyImage) is done + verified.
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
- [ ] **A1.5** Wire into MainApp lightbox — replace annotate mode + feedback panel + both save paths with `<ReviewViewer>`; preserve mention/email/task side-effects; delete dead code

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
- [ ] **C1** Login (`components/LoginPage.js`)
- [ ] **C2** Sidebar + top nav (active state = brand yellow)
- [ ] **C3** Dashboard
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
