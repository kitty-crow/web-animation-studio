export const models = [
 'rvm_mobilenetv3_fp32.onnx',
 'rvm_mobilenetv3_fp16.onnx',
 'rvm_resnet50_fp32.onnx',
 'rvm_resnet50_fp16.onnx'
] as const;
export const defaultModel = models[0];
export const runtimeName = 'onnxruntime-web-1.22.0.tgz';
export const release = 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/';
export const runtimeRelease = 'https://registry.npmjs.org/onnxruntime-web/-/'+runtimeName;
