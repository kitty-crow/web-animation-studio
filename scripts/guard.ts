import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const tracked=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=tracked.filter(path=>/\.(?:js|mjs|cjs|jsx)$/i.test(path));
if(forbidden.length)throw Error('JavaScript source is forbidden:\n'+forbidden.join('\n'));

// A gitlink is an independent repository, not a source directory of this project.
// Snapshot all first-party files, including uncommitted edits, for the complete guard suite.
const snapshot=mkdtempSync(join(tmpdir(),'animation-guards-'));
try {
 for(const path of new Set(tracked)){
  if(!existsSync(path)||!statSync(path).isFile())continue;
  const target=join(snapshot,path);
  mkdirSync(dirname(target),{recursive:true});copyFileSync(path,target);
 }
 symlinkSync(resolve('node_modules'),join(snapshot,'node_modules'),'dir');
 symlinkSync(resolve('vendor'),join(snapshot,'vendor'),'dir');
 const result=Bun.spawnSync(['bun','vendor/code-guards/src/cli.ts','all','--path',join(snapshot,'tsconfig.json'),'--strict','--include-tests'],{stdout:'inherit',stderr:'inherit'});
 process.exitCode=result.exitCode??1;
} finally {rmSync(snapshot,{recursive:true,force:true})}
