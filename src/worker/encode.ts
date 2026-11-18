import type { Palette } from '../types';
export function encodeLZW(input: Uint8Array,min: number){
 let clear=1<<min,end=clear+1,next=end+1,size=min+1,dict=new Map<number,number>(),bytes: number[]=[],buf=0,bits=0;
 function write(c: number){buf|=c<<bits;bits+=size;while(bits>=8){bytes.push(buf&255);buf>>>=8;bits-=8}}
 function emit(c: number){write(c);if(next===(1<<size)&&size<12)size++}
 write(clear);let prefix=input[0];for(let i=1;i<input.length;i++){let k=input[i],code=prefix*256+k,found=dict.get(code);if(found!==undefined){prefix=found;continue}emit(prefix);if(next<4096){dict.set(code,next++)}else{write(clear);dict.clear();next=end+1;size=min+1}prefix=k}emit(prefix);write(end);if(bits)bytes.push(buf&255);return Uint8Array.from(bytes)
}
export class Writer{parts: Uint8Array<ArrayBuffer>[]=[]; buf: number[]=[];byte(...b: number[]){for(let v of b)this.buf.push(v&255);if(this.buf.length>8192)this.flush()}word(n: number){this.byte(n,n>>8)}ascii(s: string){for(let c of s)this.byte(c.charCodeAt(0))}flush(){if(this.buf.length){this.parts.push(Uint8Array.from(this.buf));this.buf=[]}}data(a: Uint8Array){this.flush();this.parts.push(new Uint8Array(a))}sub(a: Uint8Array){for(let i=0;i<a.length;i+=255){let p=a.subarray(i,i+255);this.byte(p.length);this.data(p)}this.byte(0)}finish(){this.flush();return new Blob(this.parts,{type:'image/gif'})}}
export function createWriter(w: number,h: number,palette: Palette,loop: number | null){let wr=new Writer(),bits=Math.max(1,Math.ceil(Math.log2(palette.length))),min=Math.max(2,bits),size=1<<bits;wr.ascii('GIF89a');wr.word(w);wr.word(h);wr.byte(0x80|0x70|(bits-1),0,0);for(let i=0;i<size;i++)wr.byte(...(palette[i]||[0,0,0]));if(loop!==null){wr.byte(0x21,0xff,11);wr.ascii('NETSCAPE2.0');wr.byte(3,1);wr.word(loop);wr.byte(0)}return {wr,min}}
export function appendFrame(wr: Writer,min: number,x: number,y: number,w: number,h: number,indices: Uint8Array,delay: number,transparent: boolean,dispose: number){wr.byte(0x21,0xf9,4,(dispose<<2)|(transparent?1:0));wr.word(delay);wr.byte(0,0,0x2c);wr.word(x);wr.word(y);wr.word(w);wr.word(h);wr.byte(0,min);wr.sub(encodeLZW(indices,min))}
// Restore-to-previous avoids GIF disposal-to-background colour artefacts.
export function writeSprite(wr: Writer,min: number,w: number,h: number,current: Uint8Array,delay: number,first: boolean,optimise: boolean){
 let x0=w,y0=h,x1=-1,y1=-1;for(let p=0;p<current.length;p++)if(current[p]){const x=p%w,y=(p/w)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
 if(first||!optimise){x0=y0=0;x1=w-1;y1=h-1}if(x1<0){x0=y0=x1=y1=0}
 const rw=x1-x0+1,rh=y1-y0+1,indices=new Uint8Array(rw*rh);for(let y=0;y<rh;y++)indices.set(current.subarray((y+y0)*w+x0,(y+y0)*w+x0+rw),y*rw);
 appendFrame(wr,min,x0,y0,rw,rh,indices,delay,true,3);return {skipped:0,omitted:w*h-rw*rh};
}
// Delta encoding for normal opaque/partially transparent animations. Transparent indices
// do not erase earlier pixels, so we use a look-ahead clear when a visible pixel must vanish.
export function writeDelta(wr: Writer,min: number,w: number,h: number,current: Uint8Array,next: Uint8Array | null,base: Uint8Array,delay: number,first: boolean){
 let x0=w,y0=h,x1=-1,y1=-1,clear=false;
 function include(p: number){let x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
 for(let p=0;p<current.length;p++){
  if(current[p]!==base[p]&&current[p]===0)throw Error('Invalid GIF delta canvas.');if(current[p]!==base[p])include(p)
  if(next&&current[p]!==0&&next[p]===0){clear=true;include(p)}
 }
 // A complete first frame resets the logical canvas on replay. The last disposal
 // clears any visible pixels where the first frame must be transparent.
 if(first){x0=0;y0=0;x1=w-1;y1=h-1}
 if(x1<0){x0=y0=x1=y1=0}
 let rw=x1-x0+1,rh=y1-y0+1,delta=new Uint8Array(rw*rh),skipped=0;
 for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){let p=(y+y0)*w+x+x0;if(current[p]!==base[p])delta[y*rw+x]=current[p];if(current[p]===base[p]&&current[p]!==0)skipped++}
 appendFrame(wr,min,x0,y0,rw,rh,delta,delay,true,clear?2:1);
 base.set(current);if(clear)for(let y=y0;y<=y1;y++)base.fill(0,y*w+x0,y*w+x1+1);
 return {skipped,omitted:w*h-rw*rh};
}
// Original profile uses a local GIF palette per frame. Preserve exact RGB whenever it fits.
