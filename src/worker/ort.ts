import { type Backend } from '../types';
import { scope } from './progress';
import { runtimeAsset, type RuntimeAssets } from './runtime';
export type Ort = typeof import('onnxruntime-web');
export type Report = (step: string,label: string,percent: number,note?: string,waiting?: boolean)=>void;
async function configureAdapter(ort: Ort,report: Report): Promise<void> {

    report('adapter discovery','Requesting WebGPU adapter…',29,'Waiting for browser GPU selection');
    const adapter=await scope.navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No WebGPU adapter returned by the browser.');
    if(ort.env.webgpu)ort.env.webgpu.adapter=adapter;
    const info=adapter.info;report('adapter ready','WebGPU adapter available',30,[info.vendor,info.architecture,info.description].filter(Boolean).join(' · ')||'Adapter acquired',false);

}
export async function prepareOrt(backend: Backend,assets: RuntimeAssets,urls: string[],report: Report): Promise<Ort> {
   const gpu=backend==='webgpu';
   if(gpu&&!scope.navigator?.gpu)throw Error('WebGPU is not available in this browser context.');
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
   if(gpu)await configureAdapter(ort,report);
   return ort;

}
