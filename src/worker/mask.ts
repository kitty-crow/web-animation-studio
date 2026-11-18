import type { Frame, Settings } from '../types';
import { send } from './progress';
import { consensusMasks } from './consensus';
import { repairMasks } from './repair';
import { rvmMasks } from './rvm';
export async function removeBackground(frames: Frame[],w: number,h: number,settings: Settings,model: Uint8Array | null,runtimeFiles: File[]){
 let masks=settings.bgMethod==='rvm'?await rvmMasks(frames,w,h,settings,model,runtimeFiles):consensusMasks(frames,w,h,settings);if(settings.bgMethod==='hybrid'){const ai=await rvmMasks(frames,w,h,settings,model,runtimeFiles);send('Combining temporal and RVM masks…',78,{stage:'hybrid-combine',waiting:true});for(let i=0;i<masks.length;i++)for(let p=0;p<w*h;p++)masks[i][p]&=ai[i][p]}
 if(settings.repair){send('Preparing foreground repair…',79,{stage:'repair-init',waiting:true});masks=await repairMasks(masks,w,h);}
 send('Applying foreground masks…',87,{stage:'apply-masks',waiting:true});let removed=0;for(let i=0;i<frames.length;i++){const data=frames[i].data,mask=masks[i];for(let p=0;p<w*h;p++)if(mask[p]&&data[p*4+3]>=128){data.fill(0,p*4,p*4+4);removed++}}
 return removed;
}
