# Studio implementation · 1.4.0

Baseline: c28eabe. Original GridTone 1.3.0 ZIP retained in Downloads. Selected direction: `design/selected-reference.png`. Existing offline engine and project formats retained.

- [x] Pointer transactions: context menu, hit zones, Escape, additive selection, movement threshold, cancel/blur.
- [x] Stable shell/grid DOM; frame-coalesced pointer updates; independent playhead and mixer updates.
- [x] Playback through undo, solo/mute and tempo changes; audition return context.
- [x] Split arrangement/editor, resizable dock, continuous bars, edge scroll, separate anchored zoom, per-pattern viewports.
- [x] Seek/loop selection and stop origin; clip multi-select/copy/paste/move/duplicate/same-kind cross-track operations.
- [x] Snap resolutions/triplets/free timing, precise timing/velocity/length, before/after audition, keyboard and focus rules.
- [x] Ten recovery points; source and standalone build; browser interaction/audio/export verification.
- [x] Selected visual language in arrange/editor/mix/sound/pipeline/catalog/composer/dialog surfaces.

Evidence: `design-qa.md`, `design/qa/core-tests.tap`, `design/qa/browser-results.json`, `design/qa/pointer-result.json`.
Limits: physical touch feel, long-duration stress and subjective listening remain unmeasured. Structural audio-resource changes may still rebuild the graph. Existing sounding notes finish naturally; edits cancel and reschedule future sources.
