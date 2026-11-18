import type { InferenceSession } from 'onnxruntime-web';
import { errorText, type Backend, type Frame, type Settings } from '../types';
import { scope, send, reply } from './progress';
import { unpackRuntime, type RuntimeAssets } from './runtime';
import { prepareOrt } from './ort';
import { probeRuntime } from './probe';
import { inferMasks, type InputFrames } from './infer';
// The probe isolates runtime initialisation from model loading. A worker-level rejection signal catches asynchronous Emscripten failures that can otherwise leave the session promise unresolved.
async function runBackend(input: InputFrames,model: Uint8Array,assets: RuntimeAssets,backend: Backend): Promise<Uint8Array[]> {
 let session: InferenceSession|null=null,stage='runtime module';
 const urls: string[]=[];
 let rejectBootstrap: (reason: Error)=>void=()=>undefined;
 const bootstrapFailure=new Promise<never>((_,reject)=>{rejectBootstrap=reject});
 void bootstrapFailure.catch(()=>undefined);
 const captureBootstrap=(event: Event)=>{
  const cause=event instanceof PromiseRejectionEvent?event.reason:event instanceof ErrorEvent?event.error||event.message:'Unknown asynchronous bootstrap error';
  const message=cause instanceof Error?cause.stack||cause.message:String(cause);
  reply({type:'runtime-diagnostic',message:'Asynchronous runtime failure: '+message});
  event.preventDefault();rejectBootstrap(new Error(message));
 };
 scope.addEventListener('unhandledrejection',captureBootstrap);
 scope.addEventListener('error',captureBootstrap);
 const report=(step: string,label: string,percent: number,note='',waiting=true)=>{
  stage=step;send(backend.toUpperCase()+' · '+label,percent,{stage:backend+'-'+step,note,waiting});
 };
 try {
  const ort=await prepareOrt(backend,assets,urls,report);
  const options: InferenceSession.SessionOptions={executionProviders:[backend],graphOptimizationLevel:'basic',logSeverityLevel:2};
  await probeRuntime(ort,options,bootstrapFailure,report);
  report('RVM graph','Loading RVM model and preparing graph…',33,'Runtime test passed · Model '+(model.byteLength/1048576).toFixed(1)+' MB · '+input.w+' × '+input.h+' · Basic graph optimisations; 120-second watchdog.');
  const sessionStart=performance.now();
  session=await Promise.race([ort.InferenceSession.create(model,options),bootstrapFailure]);
  report('model input validation','Validating RVM model inputs and outputs…',34,'Session created in '+((performance.now()-sessionStart)/1000).toFixed(1)+'s');
  const masks=await inferMasks(ort,session,backend,input,report);
  report('inference complete','Inference complete; releasing session…',78,'Releasing ONNX tensors and backend resources');
  return masks;
 } catch(error) {
  const detail=backend.toUpperCase()+' ('+stage+'): '+errorText(error);
  console.error(detail,error);
  throw Error(detail,{cause:error});
 } finally {
  scope.removeEventListener('unhandledrejection',captureBootstrap);
  scope.removeEventListener('error',captureBootstrap);
  try {await session?.release()}catch(error){console.warn('ONNX resource cleanup',error)}
  for(const url of urls)URL.revokeObjectURL(url);
 }
}
export async function rvmMasks(frames: Frame[],w: number,h: number,settings: Settings,model: Uint8Array|null,runtimeFiles: File[]): Promise<Uint8Array[]> {
 if(!model)throw Error('Select an RVM ONNX model first.');
 send('Reading ONNX runtime files…',23,{stage:'runtime-files',waiting:true});
 const assets=await unpackRuntime(runtimeFiles),backends: Backend[]=settings.backend==='auto'?['webgpu','wasm']:[settings.backend],errors: string[]=[];
 for(const backend of backends){
  try {return await runBackend({frames,w,h,settings},model,assets,backend)}
  catch(error){
   const detail=errorText(error);errors.push(detail);
   if(backend==='webgpu'&&settings.backend==='auto')send('WebGPU failed; trying WASM…',26,{stage:'fallback',waiting:true,note:detail});
  }
 }
 throw Error('RVM failed. '+errors.join(' | '));
}
