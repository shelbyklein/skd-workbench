// Runs the Chrome browser suites in parallel (each uses its own temporary store and port), then reports
// every failure with the end of its output. BROWSER_TEST_JOBS sets the concurrency (default 6).
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const suites=JSON.parse(readFileSync(new URL('./browser-tests.json',import.meta.url),'utf8'));
const jobs=Math.max(1,Number(process.env.BROWSER_TEST_JOBS)||6),started=Date.now(),failed=[];let next=0;
function run(file){return new Promise(resolve=>{let out='';const child=spawn(process.execPath,[file],{stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
 child.on('close',code=>{if(code===0)console.log(`PASS ${file}`);else{failed.push(file);console.log(`FAIL ${file}\n${out.trim().split('\n').slice(-12).join('\n')}\n`);}resolve();});});}
async function worker(){while(next<suites.length)await run(suites[next++]);}
await Promise.all(Array.from({length:Math.min(jobs,suites.length)},worker));
console.log(`${suites.length-failed.length}/${suites.length} browser suites passed in ${Math.round((Date.now()-started)/1000)} s${failed.length?` — failed: ${failed.join(', ')}`:''}`);
process.exitCode=failed.length?1:0;
