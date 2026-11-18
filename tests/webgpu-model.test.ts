import { test, expect } from 'bun:test';
import { joinBytes, messageField, integerField, readFields } from '../src/worker/onnx-wire';
import { adaptWebGpuModel } from '../src/worker/webgpu-model';

const enc=new TextEncoder(),dec=new TextDecoder();
const str=(n:number,value:string)=>messageField(n,enc.encode(value));
function ints(name:string,values:number[]): Uint8Array {
 return messageField(5,joinBytes([str(1,name),integerField(20,7),...values.map(value=>integerField(8,value))]));
}
function int(name:string,value:number): Uint8Array {
 return messageField(5,joinBytes([str(1,name),integerField(20,2),integerField(3,value)]));
}
function pool(ceil:number,stride:number): Uint8Array {
 return messageField(1,joinBytes([str(1,'input'),str(2,'output'),str(4,'AveragePool'),ints('kernel_shape',[2,2]),ints('strides',[stride,stride]),ints('pads',[0,0,0,0]),int('ceil_mode',ceil),int('count_include_pad',0)]));
}
const weights=messageField(5,new Uint8Array([0,255,2,7,8,26]));
function model(node:Uint8Array): Uint8Array {
 return joinBytes([integerField(1,7),messageField(7,joinBytes([node,weights]))]);
}
test('WebGPU conversion retains model weights and replaces only equivalent pooling',()=>{
 const original=model(pool(1,2)),result=adaptWebGpuModel(original);
 expect(result.rewritten).toBe(1);
 const graph=readFields(result.bytes).find(field=>field.number===7);
 if(!graph)throw Error('Missing graph');
 const fields=readFields(graph.payload),node=fields.find(field=>field.number===1);
 if(!node)throw Error('Missing pool node');
 const attrs=readFields(node.payload).filter(field=>field.number===5).map(field=>readFields(field.payload));
 const names=attrs.map(attr=>dec.decode(attr.find(field=>field.number===1)?.payload??new Uint8Array()));
 expect(names).toEqual(['kernel_shape','strides','count_include_pad','auto_pad']);
 const autoPad=attrs.find(attr=>attr.some(field=>field.number===4&&dec.decode(field.payload)==='SAME_UPPER'));
 expect(autoPad).toBeTruthy();
 expect(fields.find(field=>field.number===5)?.encoded).toEqual(weights);
 expect(adaptWebGpuModel(result.bytes).bytes).toBe(result.bytes);
 expect(adaptWebGpuModel(original).rewritten).toBe(1);
});
test('floor mode stays intact and unsupported ceil mode is rejected',()=>{
 const original=model(pool(0,2));
 expect(adaptWebGpuModel(original).bytes).toBe(original);
 expect(()=>adaptWebGpuModel(model(pool(1,1)))).toThrow('Unsupported ceil-mode AveragePool');
});
