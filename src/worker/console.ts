import type { Frame, GifMeta, Settings } from '../types';
import { train, renderFrame } from './palette';
import { createWriter, writeSprite, writeDelta, appendFrame } from './encode';
import { send, reply } from './progress';

export function encodeConsole(frames: Frame[],meta: GifMeta,settings: Settings,removed: number): void {
 const {width:w,height:h}=settings;
 send('Optimising shared console palettes…',88);const palettes=train(frames,w,h,settings.profile),palette=[[0,0,0]],colourMap=new Map<string,number>();const mapping=palettes.map(p=>p.map(c=>{const k=c.join(',');if(!colourMap.has(k)){colourMap.set(k,palette.length);palette.push(c)}return colourMap.get(k) ?? 0}));
 const context={mapping,errors:palettes.map(()=>new Float64Array(32768)),indices:palettes.map(()=>new Uint8Array(32768).fill(255)),used:new Set<number>(),transparent:false};
 // Render with one-frame lookahead, keeping only three indexed canvases in memory.
 const transparent=frames.some(f=>{for(let i=3;i<f.data.length;i+=4)if(f.data[i]<128)return true;return false}); const {wr,min}=createWriter(w,h,palette,meta.loop);let previous: Uint8Array | null=null; const base=new Uint8Array(w*h); let skipped=0,  omitted=0;
 function render(i: number){const f=frames[i],result=renderFrame(f.data,{w,h,palettes,settings,previous,context});previous=result.groups;frames[i]={data:new Uint8ClampedArray(0),delay:f.delay};return {out:result.out,delay:f.delay}}
 let current: ReturnType<typeof render> | null=render(0);const first=current.out;
 for(let i=0;i<frames.length;i++){
  if(!current)throw Error('Missing indexed frame');
  const next=i+1<frames.length?render(i+1):null;
  // Optimisation compares the actual final indexed pixels, after removal,
  // resizing and palette conversion; never the source frames.
  if(transparent){
   const stats=writeSprite(wr,min,{w,h,current:current.out,delay:current.delay,first:i===0,optimise:settings.optimise});skipped+=stats.skipped;omitted+=stats.omitted
  }if(!transparent&&settings.optimise){
   const stats=writeDelta(wr,min,{w,h,current:current.out,next:next?next.out:meta.loop!==null?first:null,base,delay:current.delay,first:i===0});
   skipped+=stats.skipped;omitted+=stats.omitted
  }
  if(!transparent&&!settings.optimise)appendFrame(wr,min,{x:0,y:0,w,h,indices:current.out,delay:current.delay,transparent,dispose:transparent?3:1});
  current=next;if(i%2===0||i===frames.length-1)send(`Pixelating and encoding frame ${i+1} of ${frames.length}…`,Math.round(89+10*(i+1)/frames.length))
 }
 wr.byte(0x3b);const blob=wr.finish();reply({type:'done',blob,palettes,colourCount:context.used.size,meta:{...meta,width:w,height:h},transparent,removed,skipped,omitted});
}
