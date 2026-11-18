# worker/probe

Backend verification.

probeRuntime creates and executes a tiny ONNX test session before RVM graph construction. It verifies the output and releases the test tensors and session.

[Source](../../../src/worker/probe.ts)
