# GridTone 1.4 · Design QA

final result: passed

## Visual truth and evidence

- Selected reference: `design/selected-reference.png` (1586 × 992 pixels).
- Running implementation: `design/qa/desktop-final.png` (1586 × 992 capture; measured CSS viewport 1586 × 992). Browser zoom/DPR was 1.1. The capture provider additionally scales the page within its canvas; retained raw captures and normalized the 1442 × 902 content area to 1586 × 992 for comparison. This normalization does not prove native text antialiasing fidelity.
- Full paired view: `design/qa/comparison.png`; focused transport/track comparison: `design/qa/detail-comparison.png`.
- Other viewports: `laptop.png` (1280 × 720 CSS), `mobile.png` (390 × 843 CSS), in `design/qa/`. Temporary viewport overrides reset after QA.
- State: stopped, 92 BPM, glass-night demo, arrangement above the note editor. Actual project contains repeated 4-bar patterns; the reference has visually continuous 8-bar clips. The implementation exposes real pattern boundaries and shared references.

## Findings and fixes

1. **P1, resolved — editor/arrangement sizing.** Initial layout hid the dock at laptop sizes. Fixed the flex height chain and independent scroll regions. Dock remains visible at 1280 × 720 and 390 × 843. On small screens the track list scrolls intentionally; persistent controls stay inside the viewport.
2. **P2, resolved — four-track layout clipped the last row on desktop.** Track height now accounts for the resizable dock, transport and footer. All four default tracks fit at the reference viewport. Evidence: desktop-final.png.
3. **P2, resolved — stale canvas width after resize.** Resize redraw applies whenever the notes dock is open, including arrangement mode. Note grid fills the available width.
4. **P2, resolved — small-screen hidden controls.** Restored the mixing navigation, project folder and export icon. Evidence: mobile.png.
5. **P2, resolved — sound and pipeline panes cramped in a short dock.** Selecting them expands the editor; returning to notes restores the split workspace. Existing library, audition, sound parameters and processing controls remain functional.
6. **P2, resolved — old gradients and track palettes remained in secondary surfaces.** Updated the shared controls, mixer, sound panels and built-in starter palette. Slider thumbs now have a light raised surface; filled tracks indicate values. No decorative scene background.
7. **P2, resolved — dense track labels and weak hierarchy.** Enlarged desktop track names and brand, widened the fixed track header, and preserved truncation and hover titles.

## Required fidelity surfaces

- **Typography:** native macOS/PingFang fallback; desktop brand 28/21px, track names 16px, auxiliary text 12px. The reference has slightly larger musical labels. Secondary editor controls are denser to accommodate actual precision tools. Browser capture resampling softens text; exact pixel antialiasing is unverified.
- **Spacing/layout:** aligned sticky track labels, eight-bar ruler, split dock and continuous editing. Deliberate functional differences: precision toolbar, dock resizing handle, pattern reference marks, and separate audition controls. Dock defaults to 260px rather than the reference's shorter visual-only piano panel.
- **Color/tokens:** cool gray background, purple selection, apricot/orange transport and bass, neutral gray melody. Glass is limited to transport and floating surfaces. Music content is substantially opaque for reliable reading. Reference's stronger glossy highlights are restrained here to keep the canvas calm.
- **Images/assets:** no photographic or illustrative assets are required in this functional workspace. Retained supplied app logo/icon set; the score and keyboard are actual interactive musical data. Did not replace music with a background screenshot. Raw and normalized QA captures are retained.
- **Copy/content:** actual project names, instruments, bar counts and states. Shared references are explicit; key context is distinguished from transposition; audition and apply are separate. No implementation instructions exposed as product copy.

## Interaction and runtime checks

- 123/123 Node tests, including the five original gesture failures and event coalescing.
- 14/14 actual browser checks on the single-file release: solo/volume without graph or score rebuild, playing undo/tempo changes, stable grid DOM, audio output, loop/stop origins, IndexedDB/recovery, MIDI/WAV generation, project reopen.
- Direct UI checks: right-click note menu; before/after preview and atomic apply; template preview/use; sound/pipeline panels; resize; actual pointer drag plus Escape returns the document and history unchanged.
- Browser console error list empty at final runtime check.
- Screenshot comparison repeated after sizing, palette, navigation and control refinements.

## Follow-up polish / limits

- P3: exact highlight strength and hover feel remain a subjective iteration with the user.
- Physical touch hardware, output-device latency, long-duration stress and subjective listening are not certified. Browser audio signal and a short zero-late/zero-skipped sample are evidence of this run, not universal performance guarantees.

## Implementation checklist

- [x] Compare complete view and focused region with selected reference.
- [x] Resolve actionable P0/P1/P2 issues found in this pass.
- [x] Test primary editing/listening/saving/export flows.
- [x] Check small screens and console errors.
- [x] Keep local preview open; no external deployment.
