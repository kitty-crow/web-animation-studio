# types

Shared message and image structures.

Profile selects Original, NES or SNES; Backend selects WebGPU, WASM or automatic fallback. Palette and Histogram describe indexed colours. Frame carries RGBA and GIF delay; GifMeta holds dimensions, frame count, duration and loop. Settings controls conversion; Progress describes a stage. PaletteContext caches colour lookup data; Done, WorkerReply and WorkerRequest define worker messages. errorText normalises caught errors.

[Source](../../src/types.ts)
