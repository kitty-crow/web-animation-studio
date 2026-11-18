import type { Frame, GifMeta, Settings, Histogram, Palette } from '../types';
import { createWriter, encodeLZW, type Writer } from './encode';
import { nearest } from './colour';
import { send, reply } from './progress';
function originalPalette(hist: Histogram,limit: number): Palette{
 const entries=Array.from(hist,([key,count])=>({key,count,r:key>>16,g:(key>>8)&255,b:key&255}));
 if(entries.length<=limit)return entries.map(e=>[e.r,e.g,e.b]);
 function box(a: {key:number; count:number; r:number; g:number; b:number}[]){let lo=[255,255,255],hi=[0,0,0],weight=0;for(const e of a){let v=[e.r,e.g,e.b];weight+=e.count;for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],v[j]);hi[j]=Math.max(hi[j],v[j])}}let spread=hi.map((v,j)=>v-lo[j]),axis=spread.indexOf(Math.max(...spread));return {a,weight,axis,score:spread[axis]*Math.sqrt(weight)}}
 let boxes=[box(entries)];while(boxes.length<limit){let best=-1;for(let i=0;i<boxes.length;i++)if(boxes[i].a.length>1&&(best<0||boxes[i].score>boxes[best].score))best=i;if(best<0)break;const b=boxes[best],axis=(['r','g','b'] as const)[b.axis];b.a.sort((a,c)=>a[axis]-c[axis]);let half=0,i=0;while(i<b.a.length-1&&half<b.weight/2)half+=b.a[i++].count;i=Math.max(1,i);boxes.splice(best,1,box(b.a.slice(0,i)),box(b.a.slice(i)))}
 return boxes.map(b=>{let sum=[0,0,0];for(const e of b.a){sum[0]+=e.r*e.count;sum[1]+=e.g*e.count;sum[2]+=e.b*e.count}return sum.map(v=>Math.round(v/b.weight))});
}
function writeLocalFrame(wr: Writer,x: number,y: number,w: number,h: number,indices: Uint8Array,delay: number,palette: Palette,transparent: boolean,dispose: number){const bits=Math.max(1,Math.ceil(Math.log2(palette.length))),size=1<<bits;wr.byte(0x21,0xf9,4,(dispose<<2)|(transparent?1:0));wr.word(delay);wr.byte(0,0,0x2c);wr.word(x);wr.word(y);wr.word(w);wr.word(h);wr.byte(128|(bits-1));for(let i=0;i<size;i++)wr.byte(...(palette[i]||[0,0,0]));const min=Math.max(2,bits);wr.byte(min);wr.sub(encodeLZW(indices,min))}
export function encodeOriginal(frames: Frame[],w: number,h: number,meta: GifMeta,settings: Settings,removed: number){
 const n=w*h,transparent=frames.some(f=>{for(let i=3;i<f.data.length;i+=4)if(f.data[i]<128)return true;return false}),{wr}=createWriter(w,h,[[0,0,0],[0,0,0]],meta.loop),used=new Set();let prev=new Int32Array(n).fill(-1),skipped=0,omitted=0,requantised=0;
 for(let i=0;i<frames.length;i++){
  const f=frames[i],data=f.data,pixels=new Int32Array(n);for(let p=0;p<n;p++){let q=p*4;pixels[p]=data[q+3]<128?-1:(data[q]<<16)|(data[q+1]<<8)|data[q+2]}
  let delta=settings.optimise&&!transparent&&i>0,mask=(p: number)=>transparent?pixels[p]<0:delta&&pixels[p]===prev[p];
  let hist=new Map<number,number>();for(let p=0;p<n;p++)if(!mask(p))hist.set(pixels[p],(hist.get(pixels[p])||0)+1);
  // An opaque full frame can use 256 colours. If a delta needs more than 255,
  // prefer an exact full frame rather than introducing unnecessary colour loss.
  if(delta&&hist.size>255){delta=false;hist=new Map();for(const c of pixels)hist.set(c,(hist.get(c)||0)+1)}
  const trans=transparent||delta,limit=trans?255:256;if(hist.size>limit)requantised++;
  const colours=originalPalette(hist,limit),palette=trans?[[0,0,0],...colours]:colours,offset=trans?1:0,lookup=new Map<number,number>();colours.forEach((c,j)=>lookup.set((c[0]<<16)|(c[1]<<8)|c[2],j+offset));
  const crop=settings.optimise&&i>0&&(transparent||delta);let x0=crop?w:0,y0=crop?h:0,x1=crop?-1:w-1,y1=crop?-1:h-1;for(let p=0;crop&&p<n;p++){if(mask(p))continue;const x=p%w,y=(p/w)|0;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}if(x1<0)x0=y0=x1=y1=0
  const rw=x1-x0+1,rh=y1-y0+1,indices=new Uint8Array(rw*rh),actual=delta?prev.slice():new Int32Array(n).fill(-1);for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){let p=(y+y0)*w+x+x0;if(mask(p)&&delta)skipped++;if(mask(p))continueconst c=pixels[p];let k=lookup.get(c);if(k===undefined){k=offset+nearest([c>>16,(c>>8)&255,c&255],colours);lookup.set(c,k)}indices[y*rw+x]=k;const v=palette[k],rgb=(v[0]<<16)|(v[1]<<8)|v[2];actual[p]=rgb;used.add(rgb)}
  writeLocalFrame(wr,x0,y0,rw,rh,indices,f.delay,palette,trans,transparent?3:1);prev=actual;omitted+=n-rw*rh;frames[i]={data:new Uint8ClampedArray(0),delay:f.delay};if(i%2===0||i===frames.length-1)send(`Encoding original colours: frame ${i+1} / ${frames.length}…`,89+Math.floor(10*(i+1)/frames.length));
 }
 wr.byte(0x3b);reply({type:'done',blob:wr.finish(),palettes:[],colourCount:used.size,meta:{...meta,width:w,height:h},transparent,removed,skipped,omitted,requantised});
}
