# Web Animation Studio

The studio decodes animated GIFs into composited frames. It retains frame delays and loop metadata while processing transparency, colours and dimensions.

## Output

Original mode retains source dimensions and colours within GIF palette limits. NES mode uses a shared backdrop and four regional palettes; SNES mode uses eight RGB555 tile palettes. Transparent output uses cropped frames with restore-to-previous disposal.

## Background removal

Temporal consensus estimates a stationary background; recurrent video matting uses the RVM ONNX models. Hybrid mode intersects both masks. Foreground repair restores existing pixels using temporal and spatial support. Image processing runs locally.

## Models and runtime

The default model is MobileNetV3 FP32. The four ONNX release assets are provisioned from [Robust Video Matting](https://github.com/PeterL1n/RobustVideoMatting), licensed under GPL-3.0. FP16 models require compatible inference operators. The runtime package is ONNX Runtime Web 1.22.0 (MIT). A local model or runtime archive can override the provisioned files.

## Modules

- [src/types](modules/src/types.md)
- [src/models](modules/src/models.md)
- [src/main](modules/src/main.md)
- [src/ui/elements](modules/src/ui/elements.md)
- [src/ui/reactHelpers](modules/src/ui/reactHelpers.md)
- [src/ui/editor](modules/src/ui/editor.md)
- [src/ui/palette](modules/src/ui/palette.md)
- [src/ui/assets](modules/src/ui/assets.md)
- [src/worker/progress](modules/src/worker/progress.md)
- [src/worker/main](modules/src/worker/main.md)
- [src/worker/colour](modules/src/worker/colour.md)
- [src/worker/decode](modules/src/worker/decode.md)
- [src/worker/resize](modules/src/worker/resize.md)
- [src/worker/palette](modules/src/worker/palette.md)
- [src/worker/encode](modules/src/worker/encode.md)
- [src/worker/consensus](modules/src/worker/consensus.md)
- [src/worker/runtime](modules/src/worker/runtime.md)
- [src/worker/rvm](modules/src/worker/rvm.md)
- [src/worker/half](modules/src/worker/half.md)
- [src/worker/bootstrap](modules/src/worker/bootstrap.md)
- [src/worker/repair](modules/src/worker/repair.md)
- [src/worker/mask](modules/src/worker/mask.md)
- [src/worker/original](modules/src/worker/original.md)
- [src/worker/convert](modules/src/worker/convert.md)
- [scripts/assets](modules/scripts/assets.md)
- [scripts/site](modules/scripts/site.md)
- [scripts/guard](modules/scripts/guard.md)
- [pages.config](modules/pages.config.md)
