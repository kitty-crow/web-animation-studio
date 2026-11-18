import { defaultModel, models, runtimeName } from '../models';
const pending = new Map<string, Promise<File>>();
function asset(name: string): Promise<File> {
 const cached=pending.get(name);
 if(cached)return cached;
 const request=(async ()=>{
  const response=await fetch(new URL('../models/'+name,import.meta.url));
  if(!response.ok)throw Error('Asset '+name+' could not be loaded: '+response.status);
  return new File([await response.blob()],name);
 })();
 pending.set(name,request);
 void request.catch(()=>{pending.delete(name)});
 return request;
}
export function loadModel(name: string): Promise<File> {
 if(!models.some(model=>model===name))throw Error('Unknown model: '+name);
 return asset(name);
}
export const loadRuntime = (): Promise<File> => asset(runtimeName);
export function preload(): void {
 void loadModel(defaultModel).catch(console.warn);
 void loadRuntime().catch(console.warn);
}
