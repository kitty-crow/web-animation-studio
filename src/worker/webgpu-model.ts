import { readFields, readVarint, joinBytes, messageField, integerField, type WireField } from './onnx-wire';

interface Rewrite {
 bytes: Uint8Array;
 rewritten: number;
}
interface Attribute {
 name: string;
 fields: WireField[];
}
const decoder=new TextDecoder(),encoder=new TextEncoder();
function textField(fields: WireField[],number: number): string {
 const field=fields.find(item=>item.number===number&&item.wire===2);
 return field?decoder.decode(field.payload):'';
}
function attributes(fields: WireField[]): Attribute[] {
 return fields.filter(field=>field.number===5&&field.wire===2).map(field=>{
  const parts=readFields(field.payload);
  return {name:textField(parts,1),fields:parts};
 });
}
function scalar(attribute: Attribute|null): number {
 const field=attribute?.fields.find(item=>item.number===3&&item.wire===0);
 return field?readVarint(field.payload,0).value:0;
}
function packedIntegers(field: WireField): number[] {
 const result: number[]=[];
 let offset=0;
 while(offset<field.payload.length){
  const value=readVarint(field.payload,offset);
  result.push(value.value);offset=value.next;
 }
 return result;
}
function integers(attribute: Attribute|null): number[] {
 return (attribute?.fields??[]).filter(field=>field.number===8).flatMap(field=>packedIntegers(field));
}
function equal(values: number[],expected: number[]): boolean {
 return values.length===expected.length&&values.every((value,index)=>value===expected[index]);
}
function supportedPool(attrs: Attribute[]): boolean {
 const get=(name: string)=>attrs.find(item=>item.name===name)??null;
 const pads=integers(get('pads')),dilations=integers(get('dilations'));
 const autoPad=textField(get('auto_pad')?.fields??[],4);
 return equal(integers(get('kernel_shape')),[2,2])&&equal(integers(get('strides')),[2,2])&&
  (!pads.length||equal(pads,[0,0,0,0]))&&(!dilations.length||equal(dilations,[1,1]))&&
  scalar(get('count_include_pad'))===0&&(!autoPad||autoPad==='NOTSET');
}
function sameUpperAttribute(): Uint8Array {
 const attr=joinBytes([messageField(1,encoder.encode('auto_pad')),messageField(4,encoder.encode('SAME_UPPER')),integerField(20,3)]);
 return messageField(5,attr);
}
function rewritePool(fields: WireField[]): Rewrite {
 const attrs=attributes(fields);
 const ceil=scalar(attrs.find(item=>item.name==='ceil_mode')??null);
 if(ceil===0)return {bytes:joinBytes(fields.map(field=>field.encoded)),rewritten:0};
 // With 2x2 windows, stride 2, no explicit padding and excluded padding,
 // SAME_UPPER visits exactly the same samples for even and odd dimensions.
 if(ceil!==1||!supportedPool(attrs))throw Error('Unsupported ceil-mode AveragePool configuration for WebGPU');
 const kept=fields.filter(field=>field.number!==5||!['ceil_mode','pads','auto_pad'].includes(textField(readFields(field.payload),1)));
 return {bytes:joinBytes([...kept.map(field=>field.encoded),sameUpperAttribute()]),rewritten:1};
}
function transformFields(bytes: Uint8Array,transform: (field: WireField)=>Rewrite): Rewrite {
 const parts: Uint8Array[]=[];
 let rewritten=0;
 for(const field of readFields(bytes)){
  const result=transform(field);
  rewritten+=result.rewritten;
  parts.push(result.rewritten?messageField(field.number,result.bytes):field.encoded);
 }
 return {bytes:rewritten?joinBytes(parts):bytes,rewritten};
}
const unchanged=(field: WireField): Rewrite=>({bytes:field.payload,rewritten:0});
function rewriteAttribute(bytes: Uint8Array): Rewrite {
 return transformFields(bytes,field=>field.wire===2&&[6,11].includes(field.number)?rewriteGraph(field.payload):unchanged(field));
}
function rewriteNode(bytes: Uint8Array): Rewrite {
 const fields=readFields(bytes),op=textField(fields,4),domain=textField(fields,7);
 if(op==='AveragePool'&&(!domain||domain==='ai.onnx'))return rewritePool(fields);
 return transformFields(bytes,field=>field.wire===2&&field.number===5?rewriteAttribute(field.payload):unchanged(field));
}
function rewriteGraph(bytes: Uint8Array): Rewrite {
 return transformFields(bytes,field=>field.wire===2&&field.number===1?rewriteNode(field.payload):unchanged(field));
}
export function adaptWebGpuModel(bytes: Uint8Array): Rewrite {
 return transformFields(bytes,field=>field.wire===2&&field.number===7?rewriteGraph(field.payload):unchanged(field));
}
