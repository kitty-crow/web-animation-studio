const bits = new DataView(new ArrayBuffer(4));
export function toHalf(value: number): number {
 bits.setFloat32(0,value,false);
 const raw=bits.getUint32(0,false);
 const sign=(raw>>>16)&0x8000, exponent=((raw>>>23)&255)-127+15, mantissa=raw&0x7fffff;
 if(exponent>=31) return sign|0x7c00|(mantissa&&((raw>>>23)&255)===255?0x200:0);
 if(exponent<=0) return exponent < -10?sign:sign|(((mantissa|0x800000)+(1<<(13-exponent)))>>(14-exponent));
 return sign+((exponent<<10)+((mantissa+0x1000)>>13));
}
export function fromHalf(value: number): number {
 const sign=value&0x8000?-1:1, exponent=(value>>>10)&31, fraction=value&1023;
 if(exponent===0) return sign*2**-14*fraction/1024;
 if(exponent===31) return fraction?NaN:sign*Infinity;
 return sign*2**(exponent-15)*(1+fraction/1024);
}
