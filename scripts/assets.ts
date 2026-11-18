import { mkdir, stat, copyFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { models, release, runtimeName } from '../src/models';
async function exists(path: string): Promise<boolean> {
 try { await stat(path); return true } catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT')return false; throw error }
}
async function download(url: string, target: string): Promise<void> {
 const response=await fetch(url);
 if(!response.ok||!response.body)throw Error('Could not provision '+url+': '+response.status);
 const temporary=target+'.part';
 await Bun.write(temporary,response);
 await rename(temporary,target);
}
export async function provision(): Promise<void> {
 const target='site/assets/models';
 await mkdir(target,{recursive:true});
 await mkdir('.asset-cache',{recursive:true});
 for(const name of models){
  const cached=join('.asset-cache',name);
  if(!await exists(cached))await download(release+name,cached);
  await copyFile(cached,join(target,name));
 }
 const runtime=Bun.file(runtimeName);
 if(!await runtime.exists())throw Error('Missing committed runtime: '+runtimeName);
 const checksum=new Bun.CryptoHasher('sha256').update(await runtime.arrayBuffer()).digest('hex');
 if(checksum!=='e293551f9d36d003e293d0f2937fee7b3dfdcef76d71d1449b55e2d4157c7aea')throw Error('Committed ONNX runtime checksum mismatch');
 await copyFile(runtimeName,join(target,runtimeName));
}
