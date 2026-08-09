# Review / Lightbox — live-test bug tracker (from Harnesh, 2026-08-10)

> Bite-sized parts so each fix is small, fast, and low-token. Fix ONE at a time,
> commit, let Harnesh re-test. Priority: P0 blocks the core review loop.
> **Layout / UI-UX of the lightbox is being reworked later — don't polish the old
> lightbox chrome; fix behaviour, and let the legacy annotation UI be replaced.**

## ✅ Working (A1.5a, confirmed live)
- Comments: add, delete, @mention tagging, timestamp capture. ✓
- Feedback → auto-creates a revision task (with @mention + Original Feedback). ✓

## ✅ Fixed
- **B7** — auto-created revision task had a **past/wrong due date** ("Due: 3 Apr").
  Cause: `createTaskFromFeedback` anchored the due date on `project.deadline`, so a
  stale/past project deadline produced a task due in the past. Fixed: due = now +
  project turnaround (default 24h), only tightened to the project deadline if it's
  still in the future and sooner. (MainApp ~1548.) *Needs Harnesh re-test.*

## Root-cause insight
Bugs **B1, B3, B4, B5 all live in the LEGACY `AnnotationCanvas`** (the square/
circle/arrow/T + colour-dot toolbar in the screenshot). The replacement
`components/review/ReviewCanvas.js` (built + verified at `/dev/review`) already
does all of these correctly: %-coord responsive overlay, working text tool,
selectable+deletable freehand, and round dots/handles. So the clean, token-cheap
fix for four bugs at once is **A1.5b — swap AnnotationCanvas → ReviewCanvas
(overlay mode) in the lightbox annotate tab** — NOT patching the throwaway code.

## Parts

| # | Pri | Bug | Where / fix | Status |
|---|-----|-----|-------------|--------|
| B1 | P0 | Annotations don't stay aligned with the video on responsive/resize | **FIXED** — the video annotate overlay (MainApp ~9169) was `width:100%` of the wide media area, but a portrait video is a narrow centered box (object-fit:contain), so %-coords mapped to the full area incl. letterbox → horizontal drift. Now the overlay + the preview-marker layer are sized to a centered box of the video's aspect (`videoAspect` from `onLoadedMetadata`), mirroring the `<video>` element, so coords stay locked to the frame at any size. *Re-test on the portrait clip.* | ✅ fixed |
| B2 | P1 | Video loads very slowly | Perf: lightbox `<video>` may pull the full file / no poster / not using the Mux HLS rendition. Investigate `selectedAsset.url` vs `muxPlaybackId` path (~MainApp 8925). Separate small part. | open |
| B3 | P0 | Text annotation ("T") not working | **LIKELY FIXED by the B6 fix** — the `setVideoLoading` ReferenceError threw on every `canplay`, an unhandled runtime error that disrupts the component's event handling (so the text tool did nothing). Text-tool code path itself is correct. *Re-test after B6.* | needs re-test |
| B4 | P1 | Hand-drawn (freehand) annotation can't be deleted | **FIXED** in AnnotationCanvas: freehand only had `onClick` select, so the draw surface's `onMouseDown` intercepted it → could never select → no delete ×. Added a wide transparent hit-path + `onMouseDown`/`onTouchStart` select. Now click the stroke → × appears → delete. *Re-test.* | ✅ fixed |
| B5 | P2 | Boxes + colour dots render as ovals (squished on narrow width) | **FIXED** in AnnotationCanvas toolbar: added `flexShrink:0` to tool buttons + colour dots + their groups, and `overflowX:auto` on the toolbar so it scrolls instead of squishing. Any oval dots in the *lightbox top chrome* (MainApp) are separate → fold into the later UI-UX layout rework. *Re-test.* | ✅ fixed (annotate toolbar) |
| B6 | P0 | "1 error" toast in the lightbox | **FIXED** — `ReferenceError: setVideoLoading is not defined`. The `<video onCanPlay>` handler called `setVideoLoading(false)` but that state was never declared, so it threw on every `canplay`. Removed the dead handler (no loading UI used it). *Re-test.* | ✅ fixed |

## A1.5b plan (the big win — fixes B1, B3, B4, B5)
1. Add an **overlay mode** to `ReviewCanvas`: `overlay` prop → don't render its own
   `<video>/<img>`; position the annotation layer absolutely over a parent box;
   read time from the passed `videoRef` (the existing Mux player). Verify at `/dev`.
2. In the lightbox annotate tab, replace `<AnnotationCanvas>` (MainApp ~9136 image
   / ~9171 video) with `<ReviewCanvas overlay .../>` driven by the same asset +
   `handleReviewUpdate`-style writes to `annotations[]` (or unify onto feedback).
3. Retire `handleSaveAnnotations` / `handleSaveVideoAnnotations` + dead composer
   state. Harnesh re-tests live.
