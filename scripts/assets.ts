import { mkdir, copyFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { models, release, runtimeName } from '../src/models';
import { adaptWebGpuModel } from '../src/worker/webgpu-model';

type ModelName = (typeof models)[number];

// Exact byte counts from the upstream v1.0.0 release asset metadata.
const sizes: Record<ModelName,number> = {
 'rvm_mobilenetv3_fp32.onnx':14975696,
 'rvm_mobilenetv3_fp16.onnx':7503483,
 'rvm_resnet50_fp32.onnx':107479165,
 'rvm_resnet50_fp16.onnx':53752431
};

async function matches(path: string,bytes: number): Promise<boolean> {
 const file=Bun.file(path);
 return await file.exists()&&file.size===bytes;
}

async function download(name: ModelName,target: string,bytes: number): Promise<void> {
 const temporary=target+'.part';
 console.log('Downloading '+name+' ('+bytes+' bytes)');
 try {
  const process=Bun.spawn(['curl','--fail','--location','--silent','--show-error','--connect-timeout','15','--max-time','120','--retry','2','--retry-max-time','180','--output',temporary,release+name],{stdout:'inherit',stderr:'inherit'});
  const code=await process.exited;
  if(code!==0)throw Error('Download failed for '+name+' (curl exit '+code+')');
  if(!await matches(temporary,bytes))throw Error('Release asset size mismatch: '+name);
  await rename(temporary,target);
  console.log('Verified '+name+' ('+bytes+' bytes)');
 } finally {await rm(temporary,{force:true})}
}

async function provisionModel(name: ModelName,target: string): Promise<void> {
 const cached=join('.asset-cache',name),bytes=sizes[name];
 if(!await matches(cached,bytes))await download(name,cached,bytes);
 const adaptation=adaptWebGpuModel(new Uint8Array(await Bun.file(cached).arrayBuffer()));
 if(adaptation.rewritten!==3)throw Error('Unexpected RVM pooling node count: '+name+' ('+adaptation.rewritten+')');
 console.log('Verified WebGPU pooling adaptation for '+name+' ('+adaptation.rewritten+' nodes)');
 await copyFile(cached,join(target,name));
 console.log('Provisioned '+name);
}

async function provisionRuntime(target: string): Promise<void> {
 const runtime=Bun.file(runtimeName);
 if(!await runtime.exists())throw Error('Missing committed runtime: '+runtimeName);
 const checksum=new Bun.CryptoHasher('sha256').update(await runtime.arrayBuffer()).digest('hex');
 if(checksum!=='e293551f9d36d003e293d0f2937fee7b3dfdcef76d71d1449b55e2d4157c7aea')throw Error('Committed ONNX runtime checksum mismatch');
 await copyFile(runtimeName,join(target,runtimeName));
 console.log('Verified and provisioned '+runtimeName);
}
export async function provision(): Promise<void> {
 const target='site/assets/models';
 await mkdir(target,{recursive:true});
 await mkdir('.asset-cache',{recursive:true});
 await provisionRuntime(target);
 await Promise.all(models.map(name=>provisionModel(name,target)));
 console.log('All four RVM models and runtime are available');
}
if(import.meta.main)await provision();
