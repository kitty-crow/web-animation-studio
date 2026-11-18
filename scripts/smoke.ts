import { chromium, type Page } from 'playwright';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { createWriter, appendFrame } from '../src/worker/encode';

const prefix='/web-animation-studio/';
const site=resolve('site');

async function fixture(): Promise<Buffer> {
 const {wr,min}=createWriter(64,64,[[16,32,48],[255,180,100]],0);
 for(let frame=0;frame<2;frame++){
  const indices=new Uint8Array(64*64);
  for(let y=12;y<52;y++)for(let x=16+frame;x<48+frame;x++)indices[y*64+x]=1;
  appendFrame(wr,min,{x:0,y:0,w:64,h:64,indices,delay:8,transparent:false,dispose:1});
 }
 wr.byte(0x3b);
 return Buffer.from(await wr.finish().arrayBuffer());
}

async function convert(page: Page): Promise<void> {
 await page.locator('#convert').click();
 await page.waitForFunction(()=>{
  const status=document.getElementById('status');
  return status?.classList.contains('error')||status?.textContent?.startsWith('Conversion complete.');
 },undefined,{timeout:180000});
 const status=await page.locator('#status').textContent();
 assert.match(status??'',/^Conversion complete\./,await page.locator('#progressLog').textContent()??'');
 assert.equal(await page.locator('#download').isEnabled(),true);
 assert.equal(await page.locator('#outputSize').textContent(),'64 × 64');
}

const server=Bun.serve({
 port:0,
 async fetch(request){
  const url=new URL(request.url);
  if(!url.pathname.startsWith(prefix))return new Response('Not found',{status:404});
  const relative=url.pathname.slice(prefix.length);
  const path=resolve(site,relative.endsWith('/')||!relative?relative+'index.html':relative);
  if(!path.startsWith(site+'/'))return new Response('Not found',{status:404});
  const file=Bun.file(path);
  if(!await file.exists())return new Response('Not found',{status:404});
  return new Response(file);
 }
});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 const origin=server.url.origin;
 await page.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('blob:')?route.continue():route.abort());
 await page.goto(origin+prefix+'studio/');
 await page.locator('#file').setInputFiles({name:'smoke.gif',mimeType:'image/gif',buffer:await fixture()});
 await page.waitForFunction(()=>document.querySelector<HTMLButtonElement>('#convert')?.disabled===false);
 await page.locator('#unchanged').click();
 await convert(page);
 console.log('Original GIF conversion passed.');
 await page.locator('#background').check();
 await page.locator('#bgMethod').selectOption('rvm');
 await page.locator('#backend').selectOption('wasm');
 await convert(page);
 console.log('WASM RVM inference with the committed archive passed.');
} finally {
 await browser.close();
 await server.stop(true);
}
