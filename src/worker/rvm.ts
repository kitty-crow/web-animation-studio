import type { InferenceSession, Tensor } from 'onnxruntime-web';
import { errorText, type Frame, type Settings } from '../types';
import { scope, send, reply } from './progress';
import { unpackRuntime, runtimeAsset, runtimeProbeModel } from './runtime';
import { toHalf, fromHalf } from './half';
export async function rvmMasks(frames: Frame[],w: number,h: number,settings: Settings,model: Uint8Array | null,runtimeFiles: File[]){
 if(!model)throw Error('Select the official RVM MobileNetV3 FP32 ONNX model first.');
 send('Reading ONNX runtime files…',23,{stage:'runtime-files',waiting:true});const assets=await unpackRuntime(runtimeFiles||[]);const backends=settings.backend==='auto'?['webgpu','wasm']:[settings.backend];const errors=[];
 for(const backend of backends){let session: InferenceSession | null=null,rec: Tensor[]=[],ratio: Tensor | null=null,stage='runtime module',urls: string[]=[];
  let rejectBootstrap: (reason: Error)=>void=()=>undefined;const bootstrapFailure=new Promise<never>((_,reject)=>{rejectBootstrap=reject});void bootstrapFailure.catch(()=>undefined);
  const captureBootstrap=(event: Event)=>{const cause=event instanceof PromiseRejectionEvent?event.reason:event instanceof ErrorEvent?event.error||event.message:'Unknown asynchronous bootstrap error';const message=cause instanceof Error?cause.stack||cause.message:String(cause);reply({type:'runtime-diagnostic',message:'Asynchronous runtime failure: '+message});event.preventDefault();rejectBootstrap(new Error(message));};
  scope.addEventListener('unhandledrejection',captureBootstrap);scope.addEventListener('error',captureBootstrap);
  try{
   const gpu=backend==='webgpu';
   if(gpu&&!scope.navigator?.gpu)throw Error('WebGPU is not available in this browser context.');
   const name=backend.toUpperCase();
   const report=(step: string,label: string,percent: number,note='',waiting=true)=>{stage=step;send(name+' · '+label,percent,{stage:backend+'-'+step,note,waiting})};
   const stem='ort-wasm-simd-threaded'+(gpu?'.jsep':'');
   const moduleName=gpu?'ort.webgpu.min.mjs':'ort.wasm.min.mjs';
   report('runtime assets',assets.size?'Reading local runtime assets…':'Downloading runtime assets…',26,assets.size?'Offline runtime package':'Loading module, WASM loader and binary');
   const [moduleBytes,loaderBytes,wasmBytes]=await Promise.all([runtimeAsset(moduleName,assets),runtimeAsset(stem+'.mjs',assets),runtimeAsset(stem+'.wasm',assets)]);
   if(wasmBytes.length<8||wasmBytes[0]!==0||wasmBytes[1]!==97||wasmBytes[2]!==115||wasmBytes[3]!==109)throw Error('Invalid WebAssembly binary. Use the matching 1.22.0 file.');
   function moduleURL(bytes: Uint8Array<ArrayBuffer>){const url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));urls.push(url);return url}
   report('module import','Importing ONNX JavaScript module…',27,((moduleBytes.length+loaderBytes.length)/1048576).toFixed(1)+' MB JavaScript · '+(wasmBytes.length/1048576).toFixed(1)+' MB WASM');
   const ort=await import(moduleURL(moduleBytes)) as typeof import('onnxruntime-web');
   report('runtime configuration','Configuring WebAssembly runtime…',28,'Explicit local loader and binary URLs · single WASM thread');
   // ORT 1.22's wasmBinary override may bypass locateFile. Keep this override
   // out of ORT entirely; explicitly bridge the factory to the local bytes.
   const wasmURL=URL.createObjectURL(new Blob([wasmBytes],{type:'application/wasm'}));urls.push(wasmURL);
   const rawLoaderURL=moduleURL(loaderBytes);
   const bridgeURL=new URL('./bootstrap.js',import.meta.url);
   bridgeURL.searchParams.set('loader',rawLoaderURL);
   bridgeURL.searchParams.set('wasm',wasmURL);
   bridgeURL.searchParams.set('backend',backend);
   delete ort.env.wasm.wasmBinary;
   ort.env.wasm.wasmPaths={mjs:bridgeURL.href,wasm:wasmURL};
   ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.initTimeout=0;
   ort.env.logLevel='warning';
   if(gpu){
    report('adapter discovery','Requesting WebGPU adapter…',29,'Waiting for browser GPU selection');
    const adapter=await scope.navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No WebGPU adapter returned by the browser.');
    if(ort.env.webgpu)ort.env.webgpu.adapter=adapter;
    const info=adapter.info;report('adapter ready','WebGPU adapter available',30,[info.vendor,info.architecture,info.description].filter(Boolean).join(' · ')||'Adapter acquired',false);
   }
   const options: InferenceSession.SessionOptions={executionProviders:[backend],graphOptimizationLevel:'basic',logSeverityLevel:2};
   report('runtime probe session','Initialising tiny ONNX test session…',31,'Separates runtime / backend startup from RVM graph loading. Startup watchdog: 120 seconds.');
   const probeStart=performance.now();let probe: InferenceSession | null=null,probeInput: Tensor | null=null,probeOutput: InferenceSession.ReturnType | null=null;
   try{
    probe=await Promise.race([ort.InferenceSession.create(runtimeProbeModel(),options),bootstrapFailure]);
    report('runtime probe inference','Running tiny ONNX test inference…',32,'Test graph created in '+((performance.now()-probeStart)/1000).toFixed(2)+'s');
    probeInput=new ort.Tensor('float32',new Float32Array([2]),[1]);
    probeOutput=await probe.run({x:probeInput});const check=await probeOutput.y.getData() as Float32Array;if(check.length!==1||Math.abs(check[0]-2)>1e-6)throw Error('ONNX runtime test produced an incorrect result.');
    report('runtime probe cleanup','Releasing test session…',32,'Runtime test passed; releasing test resources.');
   }finally{try{probeInput?.dispose()}catch(error){console.warn('ONNX resource cleanup',error)}if(probeOutput)for(const t of Object.values(probeOutput)){try{t.dispose()}catch(error){console.warn('ONNX resource cleanup',error)}}if(probe)await probe.release()}
   report('RVM graph','Loading RVM model and preparing graph…',33,'Runtime test passed · Model '+(model.byteLength/1048576).toFixed(1)+' MB · '+w+' × '+h+' · Basic graph optimisations; 120-second watchdog.');
   const sessionStart=performance.now();
   session=await Promise.race([ort.InferenceSession.create(model,options),bootstrapFailure]);
   report('model input validation','Validating RVM model inputs and outputs…',34,'Session created in '+((performance.now()-sessionStart)/1000).toFixed(1)+'s');
   for(const name of ['src','r1i','r2i','r3i','r4i','downsample_ratio'])if(!session.inputNames.includes(name))throw Error('Unsupported ONNX model input: '+name);
   for(const name of ['pha','r1o','r2o','r3o','r4o'])if(!session.outputNames.includes(name))throw Error('Unsupported ONNX model output: '+name);
   const input=session.inputMetadata.find(item=>item.name==='src');
   const half=input?.isTensor && input.type==='float16';
   rec=Array.from({length:4},()=>half?new ort.Tensor('float16',new Uint16Array(1),[1,1,1,1]):new ort.Tensor('float32',new Float32Array(1),[1,1,1,1]));
   ratio=new ort.Tensor('float32',new Float32Array([Math.min(1,256/Math.max(w,h))]),[1]);const masks=[],n=w*h,threshold=settings.alpha/100;
   report('first inference',gpu?'Running first frame (GPU kernels / warm-up)…':'Running first frame (WASM warm-up)…',36,'Frame 1 / '+frames.length+' · The first inference may take longer.');
   const inferenceStart=performance.now();
   for(let i=0;i<frames.length;i++){
    stage='inference frame '+(i+1);const a=frames[i].data,rgb=new Float32Array(n*3);for(let p=0;p<n;p++){const k=p*4;rgb[p]=a[k]/255;rgb[n+p]=a[k+1]/255;rgb[2*n+p]=a[k+2]/255}
    const src=half?new ort.Tensor('float16',Uint16Array.from(rgb,toHalf),[1,3,h,w]):new ort.Tensor('float32',rgb,[1,3,h,w]);let out;
    try{out=await session.run({src,r1i:rec[0],r2i:rec[1],r3i:rec[2],r4i:rec[3],downsample_ratio:ratio});}finally{src.dispose()}
    for(const t of rec)t.dispose();rec=[out.r1o,out.r2o,out.r3o,out.r4o];
    const alpha=await out.pha.getData() as Float32Array | Uint16Array;if(alpha.length!==n)throw Error('RVM alpha dimensions do not match the frame.');const mask=new Uint8Array(n);for(let p=0;p<n;p++)mask[p]=(half && alpha instanceof Uint16Array?fromHalf(alpha[p]):alpha[p])<threshold?1:0;masks.push(mask);
    for(const [name,t] of Object.entries(out))if(!['r1o','r2o','r3o','r4o'].includes(name))t.dispose();
    const completed=i+1,elapsed=(performance.now()-inferenceStart)/1000;
    send(`RVM (${backend}) · ${completed} / ${frames.length} frames complete`,36+Math.floor(42*completed/frames.length),{stage:backend+'-inference',waiting:completed<frames.length,note:(completed/Math.max(elapsed,0.001)).toFixed(2)+' frames/s · '+(completed<frames.length?'Processing frame '+(completed+1):'All inference frames complete')});
   }
   report('inference complete','Inference complete; releasing session…',78,'Releasing ONNX tensors and backend resources');
   return masks;
  }catch(e){const detail=backend.toUpperCase()+' ('+stage+'): '+errorText(e);errors.push(detail);console.error(detail,e);if(backend==='webgpu'&&settings.backend==='auto')send('WebGPU failed; trying WASM…',26,{stage:'fallback',waiting:true,note:detail})}finally{scope.removeEventListener('unhandledrejection',captureBootstrap);scope.removeEventListener('error',captureBootstrap);for(const t of rec){try{t.dispose()}catch(error){console.warn('ONNX resource cleanup',error)}}if(ratio){try{ratio.dispose()}catch(error){console.warn('ONNX resource cleanup',error)}}if(session){try{await session.release()}catch(error){console.warn('ONNX resource cleanup',error)}}for(const url of urls)URL.revokeObjectURL(url)}
 }
 throw Error('RVM failed. '+errors.join(' | '));
}
// Conservative repair only restores pixels from the corresponding original frame.
