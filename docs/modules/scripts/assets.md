# scripts/assets

The provision function verifies the committed ONNX Runtime archive by SHA-256, downloads the four ONNX model release assets with curl, validates their exact byte counts and copies them into the built site. Valid cached model files can be reused. Failed downloads leave no partial target file.

Run after site generation.

[Source](../../../scripts/assets.ts)
