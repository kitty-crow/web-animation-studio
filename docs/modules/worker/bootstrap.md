# worker/bootstrap

Explicit native WASM bootstrap.

The default bootstrap factory compiles the supplied binary and passes the resulting module to Emscripten. Native instantiation progress and errors are sent to the worker's diagnostic channel.

[Source](../../../src/worker/bootstrap.ts)
