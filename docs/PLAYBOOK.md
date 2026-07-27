# Anandi Productions — PLAYBOOK (traps + industry knowledge)

> **Purpose:** build it RIGHT the first time. Read the relevant section BEFORE building in that domain.
> **Rule:** every time a trap is hit or a real lesson is learned, APPEND it here in the same session.
> This is the mechanism that stops us repeating expensive mistakes.

---

## 🔴 TRAPS ALREADY HIT ON THIS PROJECT (never repeat)

| # | Trap | The fix / rule |
|---|---|---|
| T1 | Worked 81 commits on branch `workflow-blocks-phase-1` while Vercel deploys `main` → **nothing was live**, user tested old code for weeks. Massive credit waste. | **Always commit to `main`.** After push, confirm Vercel deploys `main`. Never long-lived feature branches for this repo. |
| T2 | `createUserWithEmailAndPassword` on the primary Firebase app **auto-signs-in as the new user** → logs the admin out. | Create auth users on a **secondary Firebase app** (`initializeApp(config, 'name')`), sign out, `deleteApp`. See `AddEmployeeModal.createAuthUserIsolated`. |
| T3 | Deleting a user doc does **not** delete the Firebase Auth account → `auth/email-already-in-use` on re-add. Client SDK cannot delete arbitrary auth users. | Needs **Admin SDK** (server route + service-account env). Until then: surface a clear message; use `+tag` emails for testing. |
| T4 | Email via Resend shared `onboarding@resend.dev` only delivers to your OWN account; arbitrary recipients silently fail. | Use a **verified domain / real SMTP** (`system@anandiproductions.com`). Route is provider-agnostic: SMTP → Resend → skip. Never claim "sent" without checking the response. |
| T5 | A component defined **inside** a parent function gets a new identity every render → unmount/remount → **in-progress drawing wiped**. | Define canvas/stateful components at **module level** (outside the parent). Documented in `AnnotationCanvas.js` header. |
| T6 | Zoom via `transform: scale()` does **not** create scrollable overflow (layout box unchanged). | Zoom by setting **`width`/`height` %** on a scroll container, not `transform`. |
| T7 | Modal with no fixed height **resizes when switching tabs** (jarring). | Give tabbed modals a **fixed height** (`height: '85vh'`) + internal scroll. `components/ui/Modal.js` supports `fixedHeight`. |
| T8 | React warning "mixing shorthand + non-shorthand" when animating `border` + `borderTopColor`. | Use **individual border props** (`borderWidth/Style/Color`), never `border` shorthand alongside `borderTopColor`. |
| T9 | Dead handlers shipped (empty `onClick` arrow on "Forgot password"). | Wire handlers when you add the UI; grep for empty arrow handlers before shipping. |
| T10 | 619 raw hex + zero shared components = "coded not designed"; every change touched 5–10 files. | **Primitives first** (`components/ui/`), tokens via `useTheme()`. Never inline-style new UI. |
| T11 | `serverTimestamp()` cannot be used inside `arrayUnion()` / array elements. | Use `new Date().toISOString()` for timestamps stored inside arrays. |
| T12 | The legacy `doc.write()` and `.innerHTML` APIs are blocked by the security hook (+ real XSS risk). | Use DOM methods or a **Blob URL** for print windows (see `PayslipView.printIt`). |
| T13 | Adopting `sm-annotate` blocked late by **CC-BY-NC** license (non-commercial). | **Check the license BEFORE building** on any dependency. Prefer MIT/Apache/BSD. |
| T14 | Bash loop broke on a path containing square-bracket segments (`app/share/[token]`). | Quote paths; feed file lists via a temp file + `while IFS= read -r`. |
| T15 | Built HR for ~15 sessions while the **core product** (asset review) rotted. | Prioritize by **daily-user pain**, not by what's easy to build next. |
| T16 | Built on unverified foundations, then had to redo. | **Verify what's live before layering on it** (Phase F1). |
| T17 | Skills CLI (`PromptScript`) refuses global install for some packs. | Per-project install is expected for emil/taste skills; re-add per new project. |

---

## 📚 DOMAIN KNOWLEDGE (read before building in the area)

### Firestore data-shape (CRITICAL for A1/A2)
- Assets + comments are stored as **arrays inside the `projects/{id}` document**. Every comment/annotation add **rewrites the whole `assets` array**.
- **Firestore hard limit: 1 MB per document.** A busy project (many assets × many comments × drawings with freehand point arrays) can approach this. **Watch for it.** If a project doc grows large, migrate comments/annotations to a **subcollection** (`projects/{id}/assets/{aid}/comments/{cid}`). For now (small team) the array is fine — but note the ceiling and keep freehand paths coarse (don't store every mouse pixel; sample/round).
- Writes are last-write-wins on the whole array → concurrent editors can clobber. Acceptable at current scale; revisit if multiple people review simultaneously.

### Next.js 14 + Firebase gotchas
- Anything touching `window`/`document`/canvas must be in a `'use client'` component; libraries that touch them at import time need `dynamic(() => import(...), { ssr: false })`.
- Env vars only apply on a **new deploy** — always redeploy after changing them in Vercel.
- `NEXT_PUBLIC_*` are client-exposed; secrets (SMTP pass, service accounts) must NOT be `NEXT_PUBLIC_`.

### Video annotation / Frame.io review (A1) — how to do it right
- **Never draw on the `<video>` element.** Overlay a transparent `<canvas>`/div **absolutely positioned on top**, same box.
- Store all coords as **percentages** of the frame (resolution-independent; survives responsive resize + different playback sizes).
- A comment/drawing is tied to a **timestamp** (`video.currentTime` at creation). On playback, show a drawing only when `currentTime` is within a small window of its timestamp (or when its comment is selected). Pause before drawing.
- **Comment is the primary object**; pin + drawing + timestamp attach to it (Frame.io model). One data path, not two.
- Timeline: markers at `timestamp / duration * 100`%; click → `video.currentTime = timestamp` + pause + highlight.
- Sync scrubbing via the `timeupdate` event (throttle) — don't poll in a tight loop.
- Frame-step: `currentTime ± 1/fps` (assume 24/25/30 fps; expose if needed).

### Image loading (A2)
- Reserve space with `aspect-ratio` to avoid layout shift (CLS).
- Blur-up: show tiny/thumbnail immediately, preload full-res in a hidden `<img>`, swap on load (pattern already in `AnnotationCanvas`).
- Use `srcset`/multiple stored sizes; lazy-load below-the-fold (`loading="lazy"`).

### PDF generation + branding (E1/E2)
- HTML → print-to-PDF via Blob URL is the zero-dependency path (see `PayslipView`). Good enough for internal docs.
- Use the `ap-brand-design` skill for the official AP letterhead/format; don't invent branding.
- Preview in an `<iframe srcDoc={html}>` before download/sign.

### Accessibility / motion (baked into primitives — keep it)
- Focus rings are global (`FocusRing`); don't add outline-none without a replacement.
- Respect `prefers-reduced-motion` (`useReducedMotion`); durations 150–250ms; animate transform/opacity only.
- Touch targets ≥ 44px; labels on inputs; `aria-label` on icon-only buttons.

---

## 🔒 DECISIONS LOG (locked — don't re-litigate)
- Brand = black + yellow; `#FACC15` accent/focus only, never a fill behind text (WCAG). Primary button = black/near-white, not yellow.
- Contractors, not employees, is the default worker class (sole-prop, <10 people → no PF/ESI/gratuity/PT). Contracts reflect this.
- Video annotation = **own canvas code (MIT-safe)**, not sm-annotate.
- Comments unify onto `feedback[]`; legacy `annotations[]` stays readable, no migration.
- Work on `main`; one chunk per session; update ROADMAP every time.
- Cost-sensitive: **no parallel-agent fan-out** unless explicitly asked.
