import type { Frame, GifMeta, Settings } from '../types';
import { parseGIF } from './decode';
import { resize } from './resize';
import { encodeOriginal } from './original';
import { encodeConsole } from './console';
import { removeBackground } from './mask';
import { send } from './progress';

function decodeFrames(bytes: Uint8Array,settings: Settings): {frames:Frame[];meta:GifMeta} {
 const meta=parseGIF(bytes,false),w=settings.width,h=settings.height;if(w*h*meta.frames>65000000)throw Error('Too many output pixels across all frames. Choose a smaller resolution (65 million pixel limit).');const frames: Frame[]=[];
 send(settings.profile==='original'?'Decoding original GIF…':'Decoding GIF and reducing resolution…',1,{stage:'decode',waiting:true});parseGIF(bytes,true,(data,delay,i)=>{frames.push({data:resize(data,meta.width,meta.height,w,h,settings.sampling),delay});if(i%4===0||i===meta.frames-1)send(`Decoding frame ${i+1} of ${meta.frames}…`,Math.max(1,Math.round(12*(i+1)/meta.frames)),{stage:'decode',waiting:i+1<meta.frames})});

 return {frames,meta};
}
async function applyMasks(frames: Frame[],settings: Settings,model: Uint8Array|null,runtimeFiles: File[]): Promise<number> {
 if(!settings.background)return 0;
 send('Comparing all background references…',13);
 return removeBackground(frames,settings.width,settings.height,settings,model,runtimeFiles);
}
function exportFrames(frames: Frame[],meta: GifMeta,settings: Settings,removed: number): void {
 if(settings.profile==='original'){encodeOriginal(frames,settings.width,settings.height,meta,settings,removed);return}
 encodeConsole(frames,meta,settings,removed);
}
export async function convert(bytes: Uint8Array,settings: Settings,model: Uint8Array|null,runtimeFiles: File[]=[]): Promise<void> {
 const {frames,meta}=decodeFrames(bytes,settings);
 const removed=await applyMasks(frames,settings,model,runtimeFiles);
 exportFrames(frames,meta,settings,removed);
}
