
const NES_RAW = `626262 001fb2 2404c8 5200b2 730076 800024 730b00 522800 244400 005700 005c00 005324 003c76 000000 000000 000000
ababab 0d57ff 4b30ff 8a13ff bc08d6 d21269 c72e00 9d5400 607b00 209800 00a300 009942 007db4 000000 000000 000000
ffffff 53aeff 9085ff d365ff ff57ff ff5dcf ff7757 fa9e00 bdc700 7ae700 43f611 26ef7e 2cd5f6 4e4e4e 000000 000000
ffffff b6e1ff ced1ff e9c3ff ffbaff ffbde5 ffc9ae ffdc87 e9ef7c cdf87e b3ff9e a5ffd0 a9efff b8b8b8 000000 000000`;
export const NES=[...new Set(NES_RAW.trim().split(/\s+/))].map(h=>[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4),16)]);
export const RGB555=Array.from({length:32768},(_,n)=>[expand(n>>10),expand((n>>5)&31),expand(n&31)]);
function expand(v: number){return (v<<3)|(v>>2)}
export function key(r: number,g: number,b: number){return (Math.round(r*31/255)<<10)|(Math.round(g*31/255)<<5)|Math.round(b*31/255)}
export function distance(a: number[],b: number[]){let r=a[0]-b[0],g=a[1]-b[1],bl=a[2]-b[2];return 2*r*r+4*g*g+3*bl*bl}
function rgbDistance(r: number,g: number,b: number,c: number[]){let x=r-c[0],y=g-c[1],z=b-c[2];return 2*x*x+4*y*y+3*z*z}
export function nearest(c: number[],p: number[][]){let best=0,d=Infinity;for(let i=0;i<p.length;i++){let v=distance(c,p[i]);if(v<d){d=v;best=i}}return best}
export const NES_MAP=new Uint8Array(32768);for(let i=0;i<32768;i++) NES_MAP[i]=nearest(RGB555[i],NES);
export const clamp=(v: number)=>Math.max(0,Math.min(255,v));
