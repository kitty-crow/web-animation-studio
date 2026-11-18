import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { editorMarkup } from '../src/ui/editor';
import { provision } from './assets';
import { build } from '../vendor/pages/src/build.ts';
import { load } from '../vendor/pages/src/config.ts';
async function bundle(entry: string, name: string): Promise<void> {
 const result=await Bun.build({entrypoints:[entry],outdir:'site/assets/studio',target:'browser',format:'esm',naming:name,minify:false,sourcemap:'none'});
 if(!result.success)throw Error(result.logs.map(log=>String(log)).join('\n'));
}
await build(await load('pages.config.ts'));
const template=await readFile('site/studio/index.html','utf8');
await writeFile('site/studio/index.html',template.replace('<!-- studio:editor -->',editorMarkup()));
await mkdir('site/assets/studio',{recursive:true});
await bundle('src/main.ts','main.js');
await bundle('src/worker/main.ts','worker.js');
await bundle('src/worker/bootstrap.ts','bootstrap.js');
await provision();
