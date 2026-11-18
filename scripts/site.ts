import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { editorMarkup } from '../src/ui/editor';

async function bundle(entry: string, name: string): Promise<void> {
 console.log('Bundling '+entry+' → '+name);
 const result=await Bun.build({entrypoints:[entry],outdir:'site/assets/studio',target:'browser',format:'esm',naming:name,minify:false,sourcemap:'none'});
 if(!result.success)throw Error(result.logs.map(log=>String(log)).join('\n'));
 console.log('Built '+name+' ('+result.outputs.reduce((bytes,output)=>bytes+output.size,0)+' bytes)');
}
const pages=Bun.spawnSync(['bun','vendor/pages/src/cli.ts','build','pages.config.ts'],{stdout:'inherit',stderr:'inherit'});
if(pages.exitCode!==0)throw Error('Pages build failed');
console.log('Rendering studio markup');
const template=await readFile('site/studio/index.html','utf8');
await writeFile('site/studio/index.html',template.replace('<!-- studio:editor -->',editorMarkup()));
await mkdir('site/assets/studio',{recursive:true});
await bundle('src/main.ts','main.js');
await bundle('src/worker/main.ts','worker.js');
await bundle('src/worker/bootstrap.ts','bootstrap.js');
console.log('Studio bundles complete');
