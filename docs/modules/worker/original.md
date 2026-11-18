# worker/original

Original output encoder.

encodeOriginal preserves source RGB where possible by generating local colour tables. It quantises only when GIF palette capacity is exceeded, encodes frame delays and sends the finished GIF to the editor.

[Source](../../../src/worker/original.ts)
