# worker/runtime

Runtime package parsing and probe graph.

RuntimeAssets maps runtime filenames to byte arrays. unpackRuntime extracts supported files from the npm archive. runtimeAsset returns one file or reports missing assets. runtimeProbeModel builds a small ONNX Relu graph.

[Source](../../../src/worker/runtime.ts)
