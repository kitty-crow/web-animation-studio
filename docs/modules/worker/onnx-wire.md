# worker/onnx-wire

WireField stores a protobuf field number, wire type, payload and original encoded bytes. readVarint decodes a varint and its next offset. readFields splits a bounded message into views of the original buffer. joinBytes combines byte arrays; messageField and integerField encode individual fields. Tensor payloads are retained without numeric conversion.

[Source](../../../src/worker/onnx-wire.ts)
