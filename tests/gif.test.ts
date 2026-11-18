import { expect, test } from 'bun:test';
import { parseGIF } from '../src/worker/decode';
import { appendFrame, createWriter, writeSprite } from '../src/worker/encode';

test('GIF metadata and transparent disposal survive encoding',async ()=>{
 const {wr,min}=createWriter(2,1,[[0,0,0],[255,0,0],[0,255,0]],0);
 writeSprite(wr,min,2,1,new Uint8Array([1,0]),7,true,true);
 writeSprite(wr,min,2,1,new Uint8Array([0,2]),12,false,true);
 wr.byte(0x3b);
 const frames: number[][]=[];
 const data=new Uint8Array(await wr.finish().arrayBuffer());
 const meta=parseGIF(data,true,canvas=>frames.push(Array.from(canvas)));
 expect(meta).toEqual({width:2,height:1,frames:2,duration:190,loop:0});
 expect(frames).toEqual([[255,0,0,255,0,0,0,0],[0,0,0,0,0,255,0,255]]);
});

test('GIF LZW dictionary expansion preserves indexed pixels',async ()=>{
 const width=128,height=80,indices=new Uint8Array(width*height);
 let state=1234567;
 for(let i=0;i<indices.length;i++){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  indices[i]=(state>>>24)&63;
 }
 const palette=Array.from({length:64},(_,i)=>[i,i,i]);
 const {wr,min}=createWriter(width,height,palette,null);
 appendFrame(wr,min,0,0,width,height,indices,5,false,1);
 wr.byte(0x3b);
 const data=new Uint8Array(await wr.finish().arrayBuffer());
 let decoded: number[]=[];
 parseGIF(data,true,canvas=>{decoded=Array.from(canvas).filter((_,i)=>i%4===0)});
 expect(decoded).toEqual(Array.from(indices));
});
