import { execFileSync } from 'node:child_process';
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0');
const forbidden=tracked.filter(path=>/\.(?:js|mjs|cjs|jsx)$/i.test(path));
if(forbidden.length)throw Error('JavaScript source is forbidden:\n'+forbidden.join('\n'));
const result=Bun.spawnSync(['bun','vendor/code-guards/src/cli.ts','--path','tsconfig.json','--strict','--include-tests'],{stdout:'inherit',stderr:'inherit'});
if(result.exitCode!==0)process.exit(result.exitCode??1);
