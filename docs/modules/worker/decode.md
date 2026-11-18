# worker/decode

GIF stream decoding.

parseGIF reads GIF metadata and optionally calls a callback with each composited RGBA frame and its delay. It applies interlacing, local palettes and graphic disposal. Copy callback data before retaining it.

[Source](../../../src/worker/decode.ts)
