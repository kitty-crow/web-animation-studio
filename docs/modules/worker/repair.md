# worker/repair

Temporal foreground repair.

repairMasks takes binary masks and dimensions. It conservatively restores foreground support using neighbouring frames and spatial evidence. WebGPU is attempted when available, with a CPU implementation as fallback.

[Source](../../../src/worker/repair.ts)
