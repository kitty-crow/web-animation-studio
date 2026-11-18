import type { Palette, Profile } from '../types';
import { replaceChildrenWithReact } from './reactHelpers';
export function drawPalettes(target: HTMLElement, tag: HTMLElement, groups: Palette[], mode: Profile): void {
 if(mode==='original'){
  target.className='blank';
  target.textContent='Original colours: individual GIF colour tables, no console palette.';
  tag.textContent='Per-frame';
  return;
 }
 target.className='palette-groups'+(mode==='snes'?' sn':'');
 tag.textContent=groups.length+' subpalettes';
 replaceChildrenWithReact(target,groups.map((palette,i)=><div className="pal-group" key={i}>
  <span className="smallcaps">Palette {String(i+1).padStart(2,'0')}</span>
  <div className="swatches">{palette.map((colour,j)=>{
   const hex='#'+colour.map(v=>v.toString(16).padStart(2,'0')).join('');
   const label=hex.toUpperCase()+(j===0?' · common backdrop':'');
   return <span key={j} className="swatch" style={{background:hex}} title={label} aria-label={label}/>;
  })}</div></div>));
}
