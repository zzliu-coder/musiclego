# Groove MIDI Dataset — selected MIDI sources

Original dataset: Groove MIDI Dataset, Google LLC.
Original publication and drum mapping: https://magenta.withgoogle.com/datasets/groove
Original full MIDI-only archive: https://storage.googleapis.com/magentadata/datasets/groove/groove-v1.0.0-midionly.zip
License: Creative Commons Attribution 4.0 International (CC BY 4.0).
License text: https://creativecommons.org/licenses/by/4.0/legalcode

The three MIDI source files here were obtained from a public dataset mirror at
https://github.com/zharry29/drums-with-llm/tree/476adbc938a600eaca26bbb02648e6127b5eca64/groove
Their Git blob SHA-1 values were verified against the mirror before conversion.
The original full archive was not obtained or verified in this build environment.
No code or model weights from the mirror repository are included.

Changes in the generated library: excerpts in bar units; PPQ converted to 960;
Roland drum articulations mapped to the eight playable roles supported here;
note ends clipped at excerpt boundaries; author timing and velocity retained;
CC4 pedal controller data not replayed. New silence/ending variants are identified
as authored derivations, not additional human performances. Source files remain
byte-for-byte unchanged. Per-template lineage lives in catalog/studio-sources.json.

Attribution: Groove MIDI Dataset, Google LLC (2019), CC BY 4.0; derived excerpts by
GridTone contributors. Redistribution does not imply endorsement by Google or performers.
