import { mkdir, stat, copyFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { models, release, runtimeName, runtimeRelease } from '../src/models';
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
 const root=await exists(runtimeName)?runtimeName:join('.asset-cache',runtimeName);
 if(!await exists(root))await download(runtimeRelease,root);
 await copyFile(root,join(target,runtimeName));
}
