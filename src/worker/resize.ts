
// Weighted area downsampling averages premultiplied alpha, keeping transparent edges clean.
export function resize(src: Uint8ClampedArray,sw: number,sh: number,w: number,h: number,method: string){const out=new Uint8ClampedArray(w*h*4);if(w===sw&&h===sh){out.set(src);return out}const sx=sw/w,sy=sh/h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=(y*w+x)*4;if(method==='nearest'){const k=(Math.min(sh-1,Math.floor((y+.5)*sy))*sw+Math.min(sw-1,Math.floor((x+.5)*sx)))*4;out.set(src.subarray(k,k+4),q);continue}
 const x0=x*sx,  x1=(x+1)*sx,  y0=y*sy,  y1=(y+1)*sy; let rr=0,  gg=0,  bb=0,  aa=0;for(let yy=Math.floor(y0);yy<Math.min(sh,Math.ceil(y1));yy++){const wy=Math.min(y1,yy+1)-Math.max(y0,yy);for(let xx=Math.floor(x0);xx<Math.min(sw,Math.ceil(x1));xx++){const wt=wy*(Math.min(x1,xx+1)-Math.max(x0,xx)),i=(yy*sw+xx)*4,a=src[i+3]*wt;aa+=a;rr+=src[i]*a;gg+=src[i+1]*a;bb+=src[i+2]*a}}
 if(aa){out[q]=rr/aa;out[q+1]=gg/aa;out[q+2]=bb/aa}out[q+3]=aa/(sx*sy);
 }return out}
