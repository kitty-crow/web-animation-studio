// ONNX uses length-delimited Protocol Buffer messages. Retain each encoded
// field so graph edits never decode or reserialise tensor weights or metadata.
export interface WireField {
 number: number;
 wire: number;
 payload: Uint8Array;
 encoded: Uint8Array;
}
interface Varint {
 value: number;
 next: number;
}
export function readVarint(bytes: Uint8Array,start: number): Varint {
 let value=0;
 for(let i=0;i<10;i++){
  const offset=start+i;
  if(offset>=bytes.length)throw Error('Truncated ONNX varint');
  const byte=bytes[offset];
  value+=(byte&127)*2**(7*i);
  if(byte<128)return {value,next:offset+1};
 }
 throw Error('Invalid ONNX varint');
}
function encodeVarint(value: number): Uint8Array {
 if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid ONNX field size');
 const output: number[]=[];
 let remaining=value;
 while(remaining>=128){
  output.push((remaining%128)|128);
  remaining=Math.floor(remaining/128);
 }
 output.push(remaining);
 return Uint8Array.from(output);
}
export function joinBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
 const output=new Uint8Array(parts.reduce((size,part)=>size+part.length,0));
 let offset=0;
 for(const part of parts){output.set(part,offset);offset+=part.length;}
 return output;
}
function bounds(bytes: Uint8Array,start: number,wire: number): {start:number;end:number} {
 if(wire===0)return {start,end:readVarint(bytes,start).next};
 if(wire===1)return {start,end:start+8};
 if(wire===5)return {start,end:start+4};
 if(wire!==2)throw Error('Unsupported ONNX protobuf wire type '+wire);
 const length=readVarint(bytes,start);
 if(!Number.isSafeInteger(length.value))throw Error('Invalid ONNX message length');
 return {start:length.next,end:length.next+length.value};
}
export function readFields(bytes: Uint8Array): WireField[] {
 const fields: WireField[]=[];
 let offset=0;
 while(offset<bytes.length){
  const tag=readVarint(bytes,offset),wire=tag.value%8,number=Math.floor(tag.value/8);
  if(!Number.isSafeInteger(tag.value)||number<1)throw Error('Invalid ONNX field tag');
  const span=bounds(bytes,tag.next,wire);
  if(span.end>bytes.length)throw Error('Truncated ONNX field');
  fields.push({number,wire,payload:bytes.subarray(span.start,span.end),encoded:bytes.subarray(offset,span.end)});
  offset=span.end;
 }
 return fields;
}
export function messageField(number: number,payload: Uint8Array): Uint8Array<ArrayBuffer> {
 return joinBytes([encodeVarint(number*8+2),encodeVarint(payload.length),payload]);
}
export function integerField(number: number,value: number): Uint8Array<ArrayBuffer> {
 return joinBytes([encodeVarint(number*8),encodeVarint(value)]);
}
