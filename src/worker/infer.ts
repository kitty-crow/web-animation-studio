import type { InferenceSession } from 'onnxruntime-web';
import type { Backend, Frame, Settings } from '../types';
import { send } from './progress';
import type { Ort, Report } from './ort';
import { toHalf, fromHalf } from './half';
export interface InputFrames { frames: Frame[]; w: number; h: number; settings: Settings }
export async function inferMasks(ort: Ort,session: InferenceSession,backend: Backend,inputFrames: InputFrames,report: Report): Promise<Uint8Array[]> {
 const {frames,w,h,settings}=inputFrames;
 const gpu=backend==='webgpu';
   for(const name of ['src','r1i','r2i','r3i','r4i','downsample_ratio'])if(!session.inputNames.includes(name))throw Error('Unsupported ONNX model input: '+name);
   for(const name of ['pha','r1o','r2o','r3o','r4o'])if(!session.outputNames.includes(name))throw Error('Unsupported ONNX model output: '+name);
   const input=session.inputMetadata.find(item=>item.name==='src');
   const half=input?.isTensor && input.type==='float16';
   let rec=Array.from({length:4},()=>half?new ort.Tensor('float16',new Uint16Array(1),[1,1,1,1]):new ort.Tensor('float32',new Float32Array(1),[1,1,1,1]));
   const ratio=new ort.Tensor('float32',new Float32Array([Math.min(1,256/Math.max(w,h))]),[1]);const masks: Uint8Array[]=[],n=w*h,threshold=settings.alpha/100;

 try {
   report('first inference',gpu?'Running first frame (GPU kernels / warm-up)…':'Running first frame (WASM warm-up)…',36,'Frame 1 / '+frames.length+' · The first inference may take longer.');
   const inferenceStart=performance.now();
   for(let i=0;i<frames.length;i++){
    const a=frames[i].data,rgb=new Float32Array(n*3);for(let p=0;p<n;p++){const k=p*4;rgb[p]=a[k]/255;rgb[n+p]=a[k+1]/255;rgb[2*n+p]=a[k+2]/255}
    const src=half?new ort.Tensor('float16',Uint16Array.from(rgb,toHalf),[1,3,h,w]):new ort.Tensor('float32',rgb,[1,3,h,w]);let out;
    try{out=await session.run({src,r1i:rec[0],r2i:rec[1],r3i:rec[2],r4i:rec[3],downsample_ratio:ratio});}finally{src.dispose()}
    for(const t of rec)t.dispose();rec=[out.r1o,out.r2o,out.r3o,out.r4o];
    const alpha=await out.pha.getData() as Float32Array | Uint16Array;if(alpha.length!==n)throw Error('RVM alpha dimensions do not match the frame.');const mask=new Uint8Array(n);for(let p=0;p<n;p++)mask[p]=(half && alpha instanceof Uint16Array?fromHalf(alpha[p]):alpha[p])<threshold?1:0;masks.push(mask);
    for(const [name,t] of Object.entries(out))if(!['r1o','r2o','r3o','r4o'].includes(name))t.dispose();
    const completed=i+1,elapsed=(performance.now()-inferenceStart)/1000;
    send(`RVM (${backend}) · ${completed} / ${frames.length} frames complete`,36+Math.floor(42*completed/frames.length),{stage:backend+'-inference',waiting:completed<frames.length,note:(completed/Math.max(elapsed,0.001)).toFixed(2)+' frames/s · '+(completed<frames.length?'Processing frame '+(completed+1):'All inference frames complete')});
   }

  return masks;
 } finally {
  for(const t of rec)t.dispose();
  ratio.dispose();
 }
}
