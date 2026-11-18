import { expect, test } from 'bun:test';
import { toHalf, fromHalf } from '../src/worker/half';

test('binary16 values retain exactly representable inputs',()=>{
 for(const value of [0,0.125,0.5,1,-2,65504]){
  expect(fromHalf(toHalf(value))).toBe(value);
 }
 expect(toHalf(1)).toBe(0x3c00);
 expect(fromHalf(0x0001)).toBe(2**-24);
});
