# AMY normalized control-curve adaptation

Source: https://github.com/shorepine/amy/blob/c645a0d58402fd450819617959826be1eca162aa/amy/juno.py
Authors: Brian Whitman and Daniel PW Ellis. MIT, see LICENSE.

Adapted functions: attack/decay/release, filter frequency, resonance, LFO frequency.
AMY's original millisecond outputs are converted to seconds; input values are
bounded. Output filter frequencies are further bounded to the host sample rate.

These short conversion routines are used by the native Web Audio VA engine.
The FM4 engine and all Studio presets were authored for this application.
No factory Juno/DX patch bank, proprietary hardware PCM, or AMY WASM binary is
included. The full AMY runtime could not be downloaded in this environment; its
routing/offline fit has not been certified. The tested shipping voices use the
Web Audio graph that already owns timing, per-track output and offline export.
