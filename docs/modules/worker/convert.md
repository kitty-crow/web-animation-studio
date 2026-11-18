# worker/convert

Conversion coordination.

convert accepts GIF bytes, settings, an optional ONNX model and runtime files. It decodes and resizes source frames, applies masks, then dispatches the selected output encoder.

[Source](../../../src/worker/convert.ts)
