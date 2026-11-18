# worker/infer

Recurrent matting.

InputFrames contains frames, output dimensions and conversion settings. inferMasks maintains recurrent tensors across frames, uses the model input precision and thresholds the predicted alpha into binary masks.

[Source](../../../src/worker/infer.ts)
