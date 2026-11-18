import type { Frame, Settings } from '../types';
import { send } from './progress';
// Estimate one stationary background colour per coordinate, rather than classifying
// every repeated foreground colour as background. Match on untouched frame data.
export function consensusMasks(frames: Frame[],w: number,h: number,settings: Settings){
 const n=w*h, count=frames.length, views=frames.map(f=>new Uint32Array(f.data.buffer,f.data.byteOffset,n)), masks=frames.map(()=>new Uint8Array(n));
 if(count<2)return masks;
 const histogram=new Map<number,number>(), mode=new Uint32Array(n), valid=new Uint8Array(n), min=Math.max(2,Math.ceil(count*(settings.support||20)/100));
 send('Analysing temporal colour frequencies…',13,{stage:'consensus-histogram',waiting:true});
 for(let p=0;p<n;p++){
  if(p%Math.max(1,Math.floor(n/20))===0)send(`Analysing temporal colours · ${Math.floor(100*p/n)}%`,13+Math.floor(4*p/n),{stage:'consensus-histogram',waiting:true});
  histogram.clear();let best=0, max=0;
  for(let i=0;i<count;i++){const v=views[i][p];if(frames[i].data[4*p+3]<128)continue;const k=(histogram.get(v)||0)+1;histogram.set(v,k);if(k>max){max=k;best=v}}
  if(settings.bgMethod==='legacy'){for(let i=0;i<count;i++)masks[i][p]=Number(frames[i].data[4*p+3]>=128&&(histogram.get(views[i][p])||0)>1);continue}
  if(max>=min){mode[p]=best;valid[p]=1}
 }
 if(settings.bgMethod==='legacy')return masks;
 const queue=new Int32Array(n), candidate=new Uint8Array(n);
 for(let i=0;i<count;i++){
  const mask=masks[i],view=views[i],data=frames[i].data;let tail=0,head=0;
  for(let p=0;p<n;p++)candidate[p]=data[4*p+3]<128||(valid[p]&&view[p]===mode[p])?1:0;
  const push=(p: number)=>{if(candidate[p]&&!mask[p]){mask[p]=1;queue[tail++]=p}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x)}for(let y=0;y<h;y++){push(y*w);push(y*w+w-1)}
  while(head<tail){const p=queue[head++],x=p%w;if(x)push(p-1);if(x<w-1)push(p+1);if(p>=w)push(p-w);if(p<n-w)push(p+w)}
  // Exposed pixels behind a moving character are recognised by the spatially
  // connected consensus, including the character's original position.
  if(i%8===0)send(`Building temporal background mask ${i+1} / ${count}…`,17+Math.floor(5*i/count));
 }
 return masks;
}
