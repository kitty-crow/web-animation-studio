# Web Animation Studio

The studio decodes animated GIFs into composited frames. It retains frame delays and loop metadata while processing transparency, colours and dimensions.

## Output

Original mode retains source dimensions and colours within GIF palette limits. NES mode uses a shared backdrop and four regional palettes; SNES mode uses eight RGB555 tile palettes. Transparent output uses cropped frames with restore-to-previous disposal.

## Background removal

Temporal consensus estimates a stationary background; recurrent video matting uses the RVM ONNX models. Hybrid mode intersects both masks. Foreground repair restores existing pixels using temporal and spatial support. Image processing runs locally.

## Models and runtime

The default model is MobileNetV3 FP32. The four ONNX release assets are provisioned from [Robust Video Matting](https://github.com/PeterL1n/RobustVideoMatting), licensed under GPL-3.0. FP16 models require compatible inference operators. The runtime package is ONNX Runtime Web 1.22.0 (MIT). A local model or runtime archive can override the provisioned files.

## Modules

- [src/types](modules/types.md)
- [src/models](modules/models.md)
- [src/main](modules/main.md)
- [src/ui/elements](modules/ui/elements.md)
- [src/ui/reactHelpers](modules/ui/reactHelpers.md)
- [src/ui/editor](modules/ui/editor.md)
- [src/ui/palette](modules/ui/palette.md)
- [src/ui/assets](modules/ui/assets.md)
- [src/worker/progress](modules/worker/progress.md)
- [src/worker/main](modules/worker/main.md)
- [src/worker/colour](modules/worker/colour.md)
- [src/worker/decode](modules/worker/decode.md)
- [src/worker/resize](modules/worker/resize.md)
- [src/worker/palette](modules/worker/palette.md)
- [src/worker/encode](modules/worker/encode.md)
- [src/worker/consensus](modules/worker/consensus.md)
- [src/worker/runtime](modules/worker/runtime.md)
- [src/worker/rvm](modules/worker/rvm.md)
- [src/worker/half](modules/worker/half.md)
- [src/worker/bootstrap](modules/worker/bootstrap.md)
- [src/worker/repair](modules/worker/repair.md)
- [src/worker/mask](modules/worker/mask.md)
- [src/worker/original](modules/worker/original.md)
- [src/worker/convert](modules/worker/convert.md)
- [scripts/assets](modules/scripts/assets.md)
- [scripts/site](modules/scripts/site.md)
- [scripts/guard](modules/scripts/guard.md)
- [pages.config](modules/pages.config.md)
- [src/worker/ort](modules/worker/ort.md)
- [src/worker/probe](modules/worker/probe.md)
- [src/worker/infer](modules/worker/infer.md)
- [tests/gif.test](modules/tests/gif.test.md)
- [tests/half.test](modules/tests/half.test.md)
- [worker/console](modules/worker/console.md)
- [worker/onnx-wire](modules/worker/onnx-wire.md)
- [worker/webgpu-model](modules/worker/webgpu-model.md)
- [tests/webgpu-model.test](modules/tests/webgpu-model.test.md)
