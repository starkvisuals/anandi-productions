# Anandi Productions — BUILDING BLOCKS (vetted open source to adopt-and-own)

> **Principle:** don't reinvent, don't over-adopt. Prefer small, **permissive-licensed (MIT/Apache/BSD)** libraries we can wrap thinly and control — or our own code when a dep isn't worth it.
> **Rule:** before building a domain feature, check this file. If adopting something new, **verify its license first** (T13 in PLAYBOOK), add it here with the license, and wrap it behind our own component so we can swap it later.
> Licenses noted as of research date **2026-07**. Re-confirm on `npm`/GitHub before `npm install`.

---

## Annotation / canvas (Phase A1) — DECIDED

**Decision: keep our own %-coordinate overlay** (already in `components/AnnotationCanvas.js`). It handles rect/circle/arrow/freehand/text + drag/resize + touch/pinch, is **zero-dependency**, stores resolution-independent %-coords, and is fully ours. Port it into `components/review/ReviewCanvas.js` and add the pin tool + video sync.

**Documented upgrade path (only if needed later):**
- **Konva.js + react-konva** — MIT. Best-in-class interactive 2D canvas: object model, event bubbling, drag-drop, and a **Transformer** for rotate/resize handles + multi-select. Adopt ONLY if we hit the limits of the custom overlay (precise hit-testing, rotation, many objects). Wrap behind `ReviewCanvas` so the swap is invisible to the rest of the app.
- **Fabric.js** — MIT. SVG in/out + image editing focus. Heavier; not needed unless we add serious image editing.
- **annotorious** — BSD-3. Image-annotation-specific (great for regions on static images) but **video support is weak** — not a fit for our unified image+video loop.

Why not a full lib now: cost + control. Our overlay already works; adding Konva is a learning + dep cost we only pay if the product demands it.

## Video playback / streaming (A1, A2)
- **hls.js** — Apache-2. HLS playback (already used implicitly for Mux `.m3u8`). Keep.
- Native `<video>` is enough for mp4/webm. If we outgrow it: **Vidstack** (MIT) or **Plyr** (MIT) are the modern, skinnable players. Not needed yet.
- **Mux** (already integrated) provides renditions/posters — use its thumbnails + renditions for the A2 resolution ladder instead of generating our own.

## Image loading / performance (A2, A3)
- **Next.js `<Image>`** — built-in. Gives srcset, lazy-load, and blur placeholder for free. Prefer over hand-rolled `<img>` where the layout allows.
- **plaiceholder** (MIT) or **blurhash** (MIT) — generate tiny blur placeholders for blur-up. Use plaiceholder at upload time to store a base64 LQIP on the asset.
- **@tanstack/react-virtual** or **react-window** — MIT. Virtualize the asset grid when a project has 200+ assets (avoids rendering thousands of cards). Adopt when grids get big.

## Drag & drop (A3 reordering, folder moves)
- **@dnd-kit** — MIT. Modern, accessible, keyboard-supported DnD. Preferred over the abandoned react-beautiful-dnd.

## PDF generate + preview (E1, E2)
- **Zero-dep default:** HTML → print-to-PDF via Blob URL (already in `PayslipView`). Good for internal docs.
- **pdf-lib** — MIT. Programmatic PDF creation/editing (fill fields, stamp signatures) if we need real generated PDFs.
- **@react-pdf/renderer** — MIT. Declarative React → PDF, if layouts get complex.
- **pdf.js** (Mozilla) — Apache-2. In-app PDF **preview/rendering** (the model-release/T&C preview). Or just `<iframe src={pdfUrl}>` for stored PDFs.
- Official AP branding → the **`ap-brand-design` skill**, not invented.

## Data / utilities (already in use or cheap wins)
- **papaparse** — MIT. CSV parsing (Jibble import). In use.
- **date-fns** — MIT. Date math/formatting (lighter than moment). Adopt for payroll/attendance date logic if it grows.
- **firebase** JS SDK — Apache-2. In use.
- **nodemailer** — MIT-0. SMTP send. In use.

## Rich text / mentions (comments composer, A1.2)
- Current @mention parsing is a simple regex against the user list — **keep it** (zero-dep, works).
- If we ever need rich formatting in comments: **Tiptap** (MIT) or **Lexical** (MIT). Not needed for plain-text + mentions.

## State / data fetching (only if the app grows)
- **@tanstack/react-query** — MIT. Would replace ad-hoc Firestore fetch+setState with caching/dedupe. Big refactor — defer unless we feel the pain.

---

## Adoption checklist (before `npm install` anything)
1. License is MIT / Apache-2 / BSD? (verify on npm + GitHub — see PLAYBOOK T13)
2. Actively maintained (commit in last ~6 months, reasonable issue triage)?
3. Bundle size acceptable (check bundlephobia)? SSR-safe or dynamic-import-able?
4. Wrap it in one of OUR components so the rest of the app never imports it directly → swappable later.
5. Add it to this file with the license + why.

---

**Sources (research 2026-07):**
- [Konva vs Fabric.js comparison (DEV)](https://dev.to/lico/react-comparison-of-js-canvas-libraries-konvajs-vs-fabricjs-1dan)
- [Konva — best canvas library guide](https://konvajs.org/docs/guides/best-canvas-library.html)
- [react-konva getting started](https://konvajs.org/docs/react/index.html)
- [Best canvas libraries (Velt, Jan 2026)](https://velt.dev/blog/best-canvas-library-web-mobile-apps)
- [Open-source design SDKs (IMG.LY)](https://img.ly/blog/open-source-design-editor-sdks-a-developers-guide-to-choosing-the-right-solution/)
