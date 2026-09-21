import {mountTerminal} from './terminal-ui.js';
export function mountPlanning({host,projectID,runID,api}){
 let disposed=false,timer,terminal=null,last='',polling=false;
 host.innerHTML='<div class="planning-heading"><p role="status" id="planning-status">Loading plan…</p><button id="planning-terminal" disabled>Show CLI</button></div><p id="planning-error" class="form-error" role="alert"></p><pre id="planning-content" class="issue-markdown">Waiting for the CLI to create the plan file…</pre>';
 const status=host.querySelector('#planning-status'),error=host.querySelector('#planning-error'),content=host.querySelector('#planning-content'),button=host.querySelector('#planning-terminal');
 async function poll(){
  if(disposed||polling)return;polling=true;
  try{
   const run=await api('projects/'+projectID+'/issue-work-runs/'+runID);if(disposed)return;
   status.textContent='Issue #'+run.issueNumber+' · '+run.status+' · Draft plan';
   error.textContent=run.planError||run.error||'';
   if(run.planMarkdown!==undefined&&run.planMarkdown!==last){last=run.planMarkdown;content.textContent=last||'Waiting for the CLI to create the plan file…';}
   if(run.terminal&&!terminal){terminal=mountTerminal({session:run.terminal,api});button.disabled=false;button.onclick=()=>terminal.show();}
  }catch(e){if(!disposed)error.textContent=e.message;}
  finally{polling=false;if(!disposed)timer=setTimeout(poll,800);}
 }
 poll();
 return {dispose(){disposed=true;clearTimeout(timer);terminal?.dispose();}};
}
