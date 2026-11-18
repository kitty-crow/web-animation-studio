import { errorText } from '../types';
import { send } from './progress';
const ORT_BASES=['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/','https://unpkg.com/onnxruntime-web@1.22.0/dist/'];
const ORT_FILES=new Set(['ort.wasm.min.mjs','ort.webgpu.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']);
// Read the official npm tarball locally. Only exact runtime paths are accepted.
export async function unpackRuntime(files: File[]){
 const assets=new Map<string,Uint8Array<ArrayBuffer>>();
 for(const file of files){
  if(ORT_FILES.has(file.name)){assets.set(file.name,new Uint8Array(await file.arrayBuffer()));continue;}
  if(!/\.(?:tgz|gz)$/i.test(file.name))throw Error('Unsupported runtime file: '+file.name);
  if(file.size>100*1024*1024)throw Error('Runtime archive exceeds 100 MB.');
  if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decompress gzip. Extract the npm package and select its runtime files instead.');
  send('Extracting local ONNX runtime package…',24,{stage:'archive',waiting:true,note:'Decompressing '+file.name});
  const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let total=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>256*1024*1024)throw Error('Runtime archive expands beyond 256 MB.');chunks.push(value);}}finally{try{await reader.cancel()}catch(error){console.warn('Archive reader cleanup',error)}reader.releaseLock();}
  send('Reading runtime archive entries…',25,{stage:'archive-entries',waiting:true,note:(total/1048576).toFixed(1)+' MB decompressed'});const tar=new Uint8Array(total);let offset=0;for(const chunk of chunks){tar.set(chunk,offset);offset+=chunk.length;}chunks.length=0;
  const decoder=new TextDecoder();const field=(start: number,end: number)=>decoder.decode(tar.subarray(start,end)).split('\0')[0].trim();let found=0;
  for(let pos=0;pos+512<=tar.length;){
   if(tar.subarray(pos,pos+512).every(v=>v===0))break;
   const name=field(pos,pos+100),prefix=field(pos+345,pos+500),path=prefix?prefix+'/'+name:name,raw=field(pos+124,pos+136);
   if(!/^[0-7]+$/.test(raw))throw Error('Invalid TAR entry size in runtime package.');
   const size=parseInt(raw,8),start=pos+512,end=start+size;if(!Number.isSafeInteger(size)||end>tar.length)throw Error('Truncated runtime archive.');
   const type=tar[pos+156],regular=type===0||type===48,key=path.slice('package/dist/'.length);if(regular&&path.startsWith('package/dist/')&&ORT_FILES.has(key)){assets.set(key,tar.slice(start,end));found++;}
   if(regular&&path==='package/package.json')validatePackage(decoder.decode(tar.subarray(start,end)));
   pos=start+Math.ceil(size/512)*512;
  }
  if(!found)throw Error('No ONNX runtime assets found. Select the official onnxruntime-web-1.22.0.tgz archive.');
 }
 return assets;
}
export async function runtimeAsset(name: string,assets: Map<string,Uint8Array<ArrayBuffer>>){
 const local=assets.get(name);if(local)return local;
 if(assets.size)throw Error('Local runtime is missing '+name+'. Select the complete official 1.22.0 .tgz package. No network request was made.');
 const errors=[];for(const root of ORT_BASES){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(root+name,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return new Uint8Array(await response.arrayBuffer())}catch(e){errors.push(root+': '+errorText(e))}finally{clearTimeout(timer)}}
 throw Error('Online runtime unavailable. Download onnxruntime-web-1.22.0.tgz using the link in Local ONNX runtime and select the archive. '+name+': '+errors.join(' | '));
}
// Tiny, independent ONNX test graph: float32[1] -> Relu -> float32[1].
// ModelProto IR 8, default-domain opset 13. This tests the actual selected backend.
export function runtimeProbeModel(){
 const enc=new TextEncoder(),v=(n: number)=>{const a=[];while(n>127){a.push((n&127)|128);n=Math.floor(n/128)}a.push(n);return a},
 int=(f: number,n: number)=>[...v(f*8),...v(n)],bytes=(f: number,b: number[] | Uint8Array)=>[...v(f*8+2),...v(b.length),...b],str=(f: number,t: string)=>bytes(f,enc.encode(t));
 const value=(t: string)=>[...str(1,t),...bytes(2,bytes(1,[...int(1,1),...bytes(2,bytes(1,int(1,1)))]))];
 const node=[...str(1,'x'),...str(2,'y'),...str(4,'Relu')];
 const graph=[...bytes(1,node),...str(2,'pixel_forge_runtime_probe'),...bytes(11,value('x')),...bytes(12,value('y'))];
 return Uint8Array.from([...int(1,8),...bytes(7,graph),...bytes(8,int(2,13))]);
}

function validatePackage(source: string): void {
 const pkg=JSON.parse(source) as {name?: string;version?: string};
 if(pkg.name!=='onnxruntime-web'||pkg.version!=='1.22.0')throw Error('Select onnxruntime-web version 1.22.0, not '+pkg.name+' '+pkg.version+'.');
}
