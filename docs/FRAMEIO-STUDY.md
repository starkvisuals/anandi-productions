# Frame.io review experience — study (from Harnesh's logged-in account, 2026-08-10)

Studied `next.frame.io` (the new Adobe Frame.io) live — a real video asset in the
review player. This is the reference for our review UX. **Bottom line: our own
`ReviewViewer` (built in A1.1–A1.4) already matches ~90% of this; the fix is to
SWAP it into the lightbox (A1.5b) and TRIM a few tools — not keep patching the
legacy `AnnotationCanvas`.**

## Layout — 3 zones
1. **Thin left app rail** (icons: home, search, notifications, uploads; help/avatar bottom). Persistent app nav.
2. **Center player** — big, dark, video centered with letterbox; frame-locked while annotating. Transport bar pinned at the bottom.
3. **Right panel** — tabbed **Comments | Fields**. Header row: "All comments" + filter / sort / search / ⋯. Comment list, then the composer pinned at the bottom.

Single review screen. No modal-in-modal, no double sidebar.

## Player transport bar (left → right)
- Play/pause · loop · **speed (1.0x)** · mute/volume
- **CENTER: big SMPTE timecode** `HH:MM:SS:FF` (frames, not just seconds) + a dropdown to change format
- Right: a "current-comment/location" toggle · **settings (gear)** · **quality (HD)** · **fullscreen**
- Scrubber is a thin bar directly above the transport; comment markers sit on it.

## Comment composer (bottom of right panel) — the heart of it
- A **yellow timecode chip** showing the exact frame the comment will attach to (e.g. `00:00:00:00`), left of the input. This is Frame.io's "will attach @".
- `Leave your comment…` text input.
- Inline action icons: **Draw an annotation** (pencil), attach (Pro), emoji, "attach to timecode" toggle.
- **Scope dropdown ("Public")** + blue **send** (paper-plane).
- Clicking **Draw an annotation** swaps the icon row for the **annotation toolbar** — you draw ON the paused frame, and the drawing is attached to the comment you then type + send. **Drawing + comment + timecode = ONE object.** There is no separate "annotation mode" tab.

## Annotation toolbar (inline, only while composing)
Exact tool set (zoomed + confirmed):
`‹ collapse | ↗ arrow | ╱ line | ▢ rectangle | ✎ freehand pen | ● magenta ● yellow ● green ● orange | ↶ undo ↷ redo`

**Key findings:**
- **Only 4 shapes:** arrow, straight line, rectangle, freehand. **No ellipse/circle. No text-on-canvas tool** — the *comment text itself* is the note. (So our broken "T" text tool and the ellipse are features Frame.io doesn't even have — we can drop them.)
- **Only 4 colors** (magenta, yellow, green, orange) — not 7.
- **Undo/redo** while drawing.
- Video is **paused/frame-locked** while annotating.

## Comment card anatomy (seen in a sample)
Avatar · **Name** · relative time ("2d") · **yellow timecode chip** (click → seeks to that frame) · comment text · optional attachments · **Reply** · a comment **number (#1)** · resolve/complete + ⋯ menu on hover. Threaded replies nest under the parent.

## Interaction model (what makes it "feel like Frame.io")
1. **Comment is the primary object.** Pins/drawings/timecodes hang off a comment. One data path.
2. **Frame-accurate.** Timecode is SMPTE (frames). Comment locks to the exact frame; the composer always shows the attach-frame.
3. **Persistent, seekable markers.** Comments appear as markers on the scrubber; clicking a card (or its timecode chip, or its marker) seeks to that frame. Drawings show when you're on/near their frame.
4. **Minimal, decisive tools.** 4 shapes, 4 colors. No clutter.
5. **One panel, one flow.** Compose → optionally draw → send. Reply/resolve inline. Filter/sort/search the list.

## Gap analysis vs our app (as of today)
| Frame.io | Our app now | Action |
|---|---|---|
| One unified review screen | Legacy `AnnotationCanvas` overlay + half-wired new `CommentSidebar` fighting → double panel, drift, broken text | **Swap in `ReviewViewer` (A1.5b)** |
| Comment = primary, drawing attached | We already unified on `feedback[]` in `ReviewViewer` ✓ | keep |
| Tools: arrow/line/rect/freehand | We have pin/rect/**circle**/arrow/freehand/**text** | **drop text + circle** (or keep circle, drop text); keep pin (nice for stills) |
| 4 colors | 7 colors | trim to ~4–5 |
| SMPTE timecode (frames) | seconds only | add frames later (needs fps) |
| Persistent scrubber markers, click-seek | `VideoTimeline` already does this ✓ | keep |
| Frame-locked draw, timecode chip in composer | `ReviewCanvas`/`CommentSidebar` already do this ✓ | keep |
| Mux/HLS adaptive streaming (fast) | raw mp4 sometimes → slow (B2) | wire `ReviewCanvas` to HLS |

## How it's built (inspected via DevTools on the live app)
- **Stack:** React + **styled-components** SPA (hashed `sc-` classes, `data-styled`). Not Next.js. (We're Next.js + inline styles/tokens — fine, the techniques port.)
- **Video delivery (the B2 answer):** the player fetches `hls/master.m3u8` + `hls/media` + `segment/0,1,2…` **and** a low-res `video_h264_180.mp4` proxy. So: **180p proxy starts instantly, HLS adaptive streaming takes over.** Renditions are pre-transcoded and served from a CDN (`assets.frame.io/encode/{id}/…`). → Our fix: serve **Mux HLS + poster/proxy** (we already have `@mux/*` + `hls.js`); never play the raw upload directly.
- **Annotation rendering:** a single **`<canvas>` overlay** sized to the video's display box (backing store = CSS pixels, `position:absolute`, `pointerEvents:auto`). They draw marks into the canvas in normalized coords and **re-render on resize**. (We use an SVG/`%`-coord DOM overlay — also valid and simpler for responsive; canvas wins only for very heavy freehand. Either is fine; keep ours.)
- **Alignment technique:** the annotation layer is pinned to the **video content box** (object-fit: contain), not the container — same principle as our B1 fix (`videoAspect`-sized box).
- **Timecode:** SMPTE frames (needs fps); comment locks to the exact frame.

## Recommendation — the plan (manageable parts)
The engine already exists and is verified at `/dev/review`. Don't rebuild — **integrate + trim.**

- **A1.5b-1** — Give `ReviewCanvas` a Mux/HLS source path (reuse `hls.js`, already a dep) so it can play our real videos. Verify at `/dev/review` with a Mux id. *(also fixes B2 slow video)*
- **A1.5b-2** — Mount `ReviewViewer` in the lightbox as THE review view (replace old player + `AnnotationCanvas` + the half-wired comment panel). Focused full-screen review (app nav hidden), like Frame.io. Fixes B1/B3/B5 + the double panel in one move.
- **A1.5b-3** — Trim the toolset to match Frame.io: drop the text-on-canvas tool (comment = text) and ellipse; trim colors to magenta/yellow/green/orange (+brand). Keep pin for images.
- **Later** — SMPTE frames (needs fps), resolve/filter parity, attachments.

Each part is small, independently committable, and Harnesh-testable.
