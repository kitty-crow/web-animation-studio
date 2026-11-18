import type { Frame, Settings } from '../types';
import { parseGIF } from './decode';
import { resize } from './resize';
import { train, renderFrame } from './palette';
import { createWriter, writeSprite, writeDelta, appendFrame } from './encode';
import { encodeOriginal } from './original';
import { removeBackground } from './mask';
import { send, reply } from './progress';
export async function convert(bytes: Uint8Array,settings: Settings,model: Uint8Array | null,runtimeFiles: File[]=[]){
 let meta=parseGIF(bytes,false),w=settings.width,h=settings.height;if(w*h*meta.frames>65000000)throw Error('Too many output pixels across all frames. Choose a smaller resolution (65 million pixel limit).');const frames: Frame[]=[];
 send(settings.profile==='original'?'Decoding original GIF…':'Decoding GIF and reducing resolution…',1,{stage:'decode',waiting:true});parseGIF(bytes,true,(data,delay,i)=>{frames.push({data:resize(data,meta.width,meta.height,w,h,settings.sampling),delay});if(i%4===0||i===meta.frames-1)send(`Decoding frame ${i+1} of ${meta.frames}…`,Math.max(1,Math.round(12*(i+1)/meta.frames)),{stage:'decode',waiting:i+1<meta.frames})});
 let removed=0;if(settings.background){send('Comparing all background references…',13);removed=await removeBackground(frames,w,h,settings,model,runtimeFiles)}
 if(settings.profile==='original'){encodeOriginal(frames,w,h,meta,settings,removed);return}
 send('Optimising shared console palettes…',88);let palettes=train(frames,w,h,settings.profile),palette=[[0,0,0]],colourMap=new Map<string,number>();let mapping=palettes.map(p=>p.map(c=>{let k=c.join(',');if(!colourMap.has(k)){colourMap.set(k,palette.length);palette.push(c)}return colourMap.get(k) ?? 0}));
 let context={mapping,errors:palettes.map(()=>new Float64Array(32768)),indices:palettes.map(()=>new Uint8Array(32768).fill(255)),used:new Set<number>(),transparent:false};
 // Render with one-frame lookahead, keeping only three indexed canvases in memory.
 let transparent=frames.some(f=>{for(let i=3;i<f.data.length;i+=4)if(f.data[i]<128)return true;return false}),{wr,min}=createWriter(w,h,palette,meta.loop),previous: Uint8Array | null=null,base=new Uint8Array(w*h),skipped=0,omitted=0;
 function render(i: number){let f=frames[i],result=renderFrame(f.data,w,h,palettes,settings,previous,context);previous=result.groups;frames[i]={data:new Uint8ClampedArray(0),delay:f.delay};return {out:result.out,delay:f.delay}}
 let current: ReturnType<typeof render> | null=render(0);const first=current.out;
 for(let i=0;i<frames.length;i++){
  if(!current)throw Error('Missing indexed frame');
  const next=i+1<frames.length?render(i+1):null;
  // Optimisation compares the actual final indexed pixels, after removal,
  // resizing and palette conversion; never the source frames.
  if(transparent){
   let stats=writeSprite(wr,min,w,h,current.out,current.delay,i===0,settings.optimise);skipped+=stats.skipped;omitted+=stats.omitted
  }if(!transparent&&settings.optimise){
   let stats=writeDelta(wr,min,w,h,current.out,next?next.out:meta.loop!==null?first:null,base,current.delay,i===0);
   skipped+=stats.skipped;omitted+=stats.omitted
  }
  if(!transparent&&!settings.optimise)appendFrame(wr,min,0,0,w,h,current.out,current.delay,transparent,transparent?3:1);
  current=next;if(i%2===0||i===frames.length-1)send(`Pixelating and encoding frame ${i+1} of ${frames.length}…`,Math.round(89+10*(i+1)/frames.length))
 }
 wr.byte(0x3b);let blob=wr.finish();reply({type:'done',blob,palettes,colourCount:context.used.size,meta:{...meta,width:w,height:h},transparent,removed,skipped,omitted});
}
