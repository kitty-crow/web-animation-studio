import type { Frame, Histogram, Palette, Profile, Settings, PaletteContext } from '../types';
import { NES, NES_MAP, RGB555, key, distance, nearest, clamp } from './colour';
export function train(frames: Frame[],w: number,h: number,profile: Profile): Palette[]{
 let isNES=profile==='nes',block=isNES?16:8,groupCount=isNES?4:8,perGroup=isNES?3:15,space=isNES?NES:RGB555,tiles: {hist: [number,number][]; avg: number[]; g: number}[]=[],global=new Map<number,number>();
 const n=Math.min(12,frames.length);for(let f=0;f<n;f++){let data=frames[Math.floor(f*(frames.length-1)/Math.max(1,n-1))].data;for(let y=0;y<h;y+=block)for(let x=0;x<w;x+=block){let hist=new Map<number,number>(),rr=0,gg=0,bb=0,num=0,step=block/4;for(let yy=y;yy<Math.min(y+block,h);yy+=step)for(let xx=x;xx<Math.min(x+block,w);xx+=step){let i=(yy*w+xx)*4;if(data[i+3]<128)continue;let k=key(data[i],data[i+1],data[i+2]);if(isNES)k=NES_MAP[k];hist.set(k,(hist.get(k)||0)+1);global.set(k,(global.get(k)||0)+1);let c=space[k];rr+=c[0];gg+=c[1];bb+=c[2];num++}if(num)tiles.push({hist:[...hist],avg:[rr/num,gg/num,bb/num],g:0})}}
 // Extremely sparse transparent images can escape the sample grid. Retain their colours.
 for(const f of frames){if(global.size)break;for(let i=0;i<f.data.length;i+=4){if(f.data[i+3]<128)continue;const rgb=key(f.data[i],f.data[i+1],f.data[i+2]),k=isNES?NES_MAP[rgb]:rgb;global.set(k,(global.get(k)||0)+1)}}
 let backdropKey=0,max=-1;for(let [k,v] of global)if(v>max){max=v;backdropKey=k}let backdrop=space[backdropKey];
 if(!tiles.length)tiles.push({hist:[...global],avg:backdrop,g:0});
 // Deterministic farthest-point cluster seeds, then minimise per-region palette error.
 let seeds=[tiles[0].avg],seedDistances=new Float64Array(tiles.length);seedDistances.fill(Infinity);for(let g=1;g<groupCount;g++){let last=seeds[g-1],best=-1,at=0;for(let i=0;i<tiles.length;i++){seedDistances[i]=Math.min(seedDistances[i],distance(tiles[i].avg,last));if(seedDistances[i]>best){best=seedDistances[i];at=i}}seeds.push(tiles[at].avg)}
 for(let t of tiles)t.g=nearest(t.avg,seeds);
 function nesPalette(hist: Histogram){let entries=[...hist],chosen=[backdropKey],loss=entries.map(([k])=>distance(space[k],backdrop));for(let s=0;s<perGroup;s++){let best=-Infinity,at=-1;for(let c=0;c<space.length;c++){if(chosen.includes(c))continue;let gain=0;for(let i=0;i<entries.length;i++)gain+=Math.max(0,loss[i]-distance(space[entries[i][0]],space[c]))*entries[i][1];if(gain>best){best=gain;at=c}}if(at<0)break;chosen.push(at);for(let i=0;i<entries.length;i++)loss[i]=Math.min(loss[i],distance(space[entries[i][0]],space[at]))}return chosen.map(k=>space[k])}
 function snesPalette(hist: Histogram){let entries=[...hist].filter(([k])=>k!==backdropKey).map(([k,v])=>({c:space[k],k,v}));if(!entries.length)return [backdrop];
 function box(arr: {c:number[]; k:number; v:number}[]){let lo=[255,255,255],hi=[0,0,0],sum=0;for(let q of arr){for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],q.c[a]);hi[a]=Math.max(hi[a],q.c[a])}sum+=q.v}let ranges=hi.map((v,i)=>(v-lo[i])*[1.4,2,1.7][i]),axis=ranges.indexOf(Math.max(...ranges));return {arr,sum,axis,score:arr.length>1?ranges[axis]*Math.sqrt(sum):0}}
 let boxes=[box(entries)];while(boxes.length<perGroup){let bi=0;for(let i=1;i<boxes.length;i++)if(boxes[i].score>boxes[bi].score)bi=i;let b=boxes[bi];if(!b.score)break;b.arr.sort((u,v)=>u.c[b.axis]-v.c[b.axis]);let s=0,cut=1;for(let i=0;i<b.arr.length-1;i++){s+=b.arr[i].v;cut=i+1;if(s>=b.sum/2)break}boxes.splice(bi,1,box(b.arr.slice(0,cut)),box(b.arr.slice(cut)))}
 let colors=[backdrop];for(let b of boxes){let sums=[0,0,0];for(let q of b.arr)for(let a=0;a<3;a++)sums[a]+=q.c[a]*q.v;let c=RGB555[key(sums[0]/b.sum,sums[1]/b.sum,sums[2]/b.sum)];if(!colors.includes(c))colors.push(c)}
 // Refine median-cut centroids; keep every centroid inside RGB555.
 for(let pass=0;pass<2;pass++){let sums=colors.map(()=>[0,0,0,0]);for(let q of entries){let j=nearest(q.c,colors),a=sums[j];a[0]+=q.c[0]*q.v;a[1]+=q.c[1]*q.v;a[2]+=q.c[2]*q.v;a[3]+=q.v}for(let j=1;j<colors.length;j++){let a=sums[j];if(a[3])colors[j]=RGB555[key(a[0]/a[3],a[1]/a[3],a[2]/a[3])]}colors=[...new Set(colors)]}return colors}
 let palettes: Palette[]=[];for(let pass=0;pass<3;pass++){let hist=Array.from({length:groupCount},()=>new Map<number,number>());for(let t of tiles)for(let [k,v] of t.hist)hist[t.g].set(k,(hist[t.g].get(k)||0)+v);palettes=hist.map(m=>(isNES?nesPalette:snesPalette)(m.size?m:global));
 if(pass===2)break;let cache=palettes.map(()=>new Float64Array(space.length).fill(-1));for(let t of tiles){let best=Infinity,at=t.g;for(let g=0;g<groupCount;g++){let e=0;for(let [k,v] of t.hist){let d=cache[g][k];if(d<0){d=distance(space[k],palettes[g][nearest(space[k],palettes[g])]);cache[g][k]=d}e+=v*d}if(e<best){best=e;at=g}}t.g=at}}
 return palettes
}
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export function renderFrame(data: Uint8ClampedArray,w: number,h: number,palettes: Palette[],settings: Settings,previous: Uint8Array | null,context: PaletteContext){
 let block=settings.profile==='nes'?16:8,gw=Math.ceil(w/block),out=new Uint8Array(w*h),groups=new Uint8Array(gw*Math.ceil(h/block)),errors=context.errors,indices=context.indices;
 function lookup(g: number,k: number){if(indices[g][k]===255){let p=palettes[g],c=RGB555[k],at=nearest(c,p);indices[g][k]=at;errors[g][k]=distance(c,p[at])}return indices[g][k]}
 let strength=settings.dither/100*(settings.profile==='nes'?76:42);
 for(let y=0;y<h;y+=block)for(let x=0;x<w;x+=block){let errorsByGroup=new Float64Array(palettes.length),tile=(y/block)*gw+x/block,xe=Math.min(w,x+block),ye=Math.min(h,y+block);
 for(let yy=y;yy<ye;yy++)for(let xx=x;xx<xe;xx++){let i=(yy*w+xx)*4;if(data[i+3]<128)continue;let k=key(data[i],data[i+1],data[i+2]);for(let g=0;g<palettes.length;g++){lookup(g,k);errorsByGroup[g]+=errors[g][k]}}
 let best=0;for(let g=1;g<palettes.length;g++)if(errorsByGroup[g]<errorsByGroup[best])best=g;const old=previous?.[tile];if(settings.stability&&old!==undefined&&errorsByGroup[old]<=errorsByGroup[best]*1.08+300)best=old;groups[tile]=best;let pal=palettes[best];
 for(let yy=y;yy<ye;yy++)for(let xx=x;xx<xe;xx++){let p=yy*w+xx,i=p*4;if(data[i+3]<128){out[p]=0;context.transparent=true;continue}let offset=((BAYER[(yy&3)*4+(xx&3)]+.5)/16-.5)*strength,r=clamp(data[i]+offset),g=clamp(data[i+1]+offset),b=clamp(data[i+2]+offset);let idx=lookup(best,key(r,g,b)),ci=context.mapping[best][idx];out[p]=ci;context.used.add(ci)}
 }return {out,groups}
}
