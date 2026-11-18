import type { GifMeta } from '../types';
interface Previous { delay: number; dispose: number; trans: number; x: number; y: number; fw: number; fh: number; saved: Uint8ClampedArray | null }
class Reader{
 i=0; constructor(readonly d: Uint8Array){}
 byte(){if(this.i>=this.d.length)throw Error('Unexpected end of GIF.');return this.d[this.i++]}
 word(){return this.byte()|this.byte()<<8}
 take(n: number){if(this.i+n>this.d.length)throw Error('Truncated GIF data.');let a=this.d.subarray(this.i,this.i+n);this.i+=n;return a}
 sub(){let parts=[],len=0;for(let n;(n=this.byte())!==0;){parts.push(this.take(n));len+=n}let a=new Uint8Array(len),i=0;for(let p of parts){a.set(p,i);i+=p.length}return a}
 table(n: number){return this.take(n*3)}
}
function lzwDecode(data: Uint8Array,min: number,n: number){
 if(min<2||min>8)throw Error('Unsupported GIF LZW code size.');
 const clear=1<<min,end=clear+1,pre=new Uint16Array(4096),suf=new Uint8Array(4096),stack=new Uint8Array(4097),out=new Uint8Array(n);
 for(let i=0;i<clear;i++)suf[i]=i;
 let size=min+1,next=end+1,prev=-1,first=0,bits=0,buf=0,at=0,pos=0;
 while(pos<n){while(bits<size){if(at>=data.length)throw Error('Incomplete GIF frame data.');buf|=data[at++]<<bits;bits+=8}let code=buf&((1<<size)-1);buf>>>=size;bits-=size;
 if(code===clear){size=min+1;next=end+1;prev=-1;continue}if(code===end)break;
 if(prev===-1){if(code>=clear)throw Error('Invalid GIF LZW stream.');out[pos++]=first=code;prev=code;continue}
 let cur=code,top=0;if(cur===next){stack[top++]=first;cur=prev}else if(cur>next)throw Error('Invalid GIF dictionary reference.');
 while(cur>=clear){if(cur>=next||top>=4096)throw Error('Corrupt GIF dictionary.');stack[top++]=suf[cur];cur=pre[cur]}
 first=cur;stack[top++]=first;while(top&&pos<n)out[pos++]=stack[--top];
 if(next<4096){pre[next]=prev;suf[next]=first;next++;if(next===(1<<size)&&size<12)size++}prev=code;
 }
 if(pos!==n)throw Error('GIF frame ended before all pixels were decoded.');return out
}
export function parseGIF(bytes: Uint8Array,decode: boolean,onFrame: (data: Uint8ClampedArray, delay: number, index: number)=>void = ()=>undefined): GifMeta{
 const r=new Reader(bytes),header=String.fromCharCode(...r.take(6));if(header!=='GIF87a'&&header!=='GIF89a')throw Error('This file is not a valid GIF.');
 const w=r.word(),h=r.word();if(!w||!h||w*h>24000000)throw Error('GIF canvas exceeds the 24-megapixel safety limit.');let packed=r.byte(),bg=r.byte();r.byte();let global=packed&128?r.table(1<<((packed&7)+1)):null;
 let gce={delay:0,dispose:0,trans:-1},loop: number | null=null,count=0,total=0,canvas=new Uint8ClampedArray(decode?w*h*4:0),previous: Previous | null=null,bgColour=global&&bg*3+2<global.length?[global[bg*3],global[bg*3+1],global[bg*3+2],255]:[0,0,0,0],initialTransparent=false;
 function fillRect(x: number,y: number,fw: number,fh: number,c: number[]){for(let yy=y;yy<Math.min(h,y+fh);yy++)for(let xx=x;xx<Math.min(w,x+fw);xx++){let q=(yy*w+xx)*4;canvas[q]=c[0];canvas[q+1]=c[1];canvas[q+2]=c[2];canvas[q+3]=c[3]}}
 while(r.i<bytes.length){let marker=r.byte();if(marker===0x3b)break;
 if(marker===0x21){let label=r.byte();if(label===0xf9){if(r.byte()!==4)throw Error('Invalid GIF graphic control block.');let p=r.byte(),delay=r.word(),ti=r.byte();if(r.byte()!==0)throw Error('Invalid GIF control terminator.');gce={delay,dispose:(p>>2)&7,trans:p&1?ti:-1}}
 else if(label===0xff){let n=r.byte(),id=String.fromCharCode(...r.take(n)),d=r.sub();if((id==='NETSCAPE2.0'||id==='ANIMEXTS1.0')&&d.length>=3&&d[0]===1)loop=d[1]|d[2]<<8}
 else{r.sub();if(label===1)gce={delay:0,dispose:0,trans:-1}}continue}
 if(marker===0)continue;if(marker!==0x2c)throw Error('Invalid GIF block marker.');
 let x=r.word(),y=r.word(),fw=r.word(),fh=r.word(),p=r.byte();if(!fw||!fh||fw*fh>24000000)throw Error('Invalid or oversized GIF frame.');let table=p&128?r.table(1<<((p&7)+1)):global;let min=r.byte(),compressed=r.sub();if(!table)throw Error('GIF frame has no colour table.');
 if(decode){if(count===0){initialTransparent=gce.trans>=0;if(!initialTransparent)fillRect(0,0,w,h,bgColour)}
 if(previous){if(previous.dispose===2)fillRect(previous.x,previous.y,previous.fw,previous.fh,previous.trans>=0||initialTransparent?[0,0,0,0]:bgColour);else if(previous.dispose===3&&previous.saved)canvas.set(previous.saved)}
 let saved=gce.dispose===3?canvas.slice():null,indices=lzwDecode(compressed,min,fw*fh),rowOrder=[];if(p&64){for(let [start,step] of [[0,8],[4,8],[2,4],[1,2]])for(let yy=start;yy<fh;yy+=step)rowOrder.push(yy)}else{for(let yy=0;yy<fh;yy++)rowOrder.push(yy)}
 let at=0;for(let yy of rowOrder){let oy=y+yy;for(let xx=0;xx<fw;xx++){let c=indices[at++],ox=x+xx;if(c===gce.trans||ox>=w||oy>=h)continue;let ci=c*3;if(ci+2>=table.length)throw Error('GIF pixel refers to a missing palette colour.');let q=(oy*w+ox)*4;canvas[q]=table[ci];canvas[q+1]=table[ci+1];canvas[q+2]=table[ci+2];canvas[q+3]=255}}
 onFrame(canvas,gce.delay,count);previous={...gce,x,y,fw,fh,saved};}
 count++;total+=gce.delay*10;gce={delay:0,dispose:0,trans:-1};
 }
 if(!count)throw Error('No image frames were found in this GIF.');return {width:w,height:h,frames:count,duration:total,loop}
}
