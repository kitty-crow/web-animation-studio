# worker/webgpu-model

adaptWebGpuModel inspects ONNX graph nodes, including nested graphs, before WebGPU inference. For 2×2 AveragePool with stride 2, ceil mode, zero explicit padding and excluded padding, it replaces ceil mode with SAME_UPPER. Both operations average the same valid input samples, including at odd image boundaries. The result contains bytes and a rewritten node count. Other ceil-mode AveragePool configurations raise an error. The original model remains available to the WASM backend.

[Source](../../../src/worker/webgpu-model.ts)
