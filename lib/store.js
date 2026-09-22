import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { assert, copy, id, now, seedFlows, validateFlow, createRun, transition } from './domain.js';
export class Store {
  constructor(directory) {
    mkdirSync(directory, {recursive:true});
    this.file = path.join(directory, 'store.json');
    if (existsSync(this.file)) {
      const original=readFileSync(this.file, 'utf8');
      this.data = JSON.parse(original);
      assert([1,2].includes(this.data.schema) && Array.isArray(this.data.flows) && Array.isArray(this.data.runs), 'Unsupported or damaged store. Restore a backup before starting.');
      if(this.data.schema===1){
        const backup=this.file+'.schema-1.'+id()+'.backup.json';
        writeFileSync(backup,original,{flag:'wx',mode:0o600});
        this.data={...this.data,schema:2,projects:[unassigned()],flows:this.data.flows.map(f=>({...f,projectID:'unassigned'})),runs:this.data.runs.map(r=>({...r,projectID:'unassigned',projectSnapshot:null,sourceContext:null}))};
        this.persist(this.data);
      }
      assert(Array.isArray(this.data.projects)&&this.data.projects.some(p=>p.id==='unassigned'),'Store is missing its projects. Restore a backup.');
    } else { this.data = {schema:2,projects:[unassigned()],flows:seedFlows().map(f=>({...f,projectID:'unassigned'})),runs:[]}; this.persist(this.data); }
  }
  persist(data) {
    const temp = this.file + '.tmp';
    writeFileSync(temp, JSON.stringify(data,null,2), {mode:0o600});
    renameSync(temp, this.file);
  }
  change(fn) {
    const draft = copy(this.data);
    const result = fn(draft);
    this.persist(draft); this.data = draft;
    return copy(result);
  }
  snapshot() { return copy(this.data); }
  project(projectID){const p=this.data.projects.find(p=>p.id===projectID);assert(p,'Project not found.',404);return copy(p);}
  createProject(input){
    const fields=projectFields(input);
    return this.change(d=>{assert(!d.projects.some(p=>p.folderPath===fields.folderPath),'This folder is already connected to a project.',409);const p={...fields,id:id(),version:1,updatedAt:now()};d.projects.push(p);return p;});
  }
  updateProject(projectID,input){
    assert(projectID!=='unassigned','Unassigned cannot be edited.');
    const fields=projectFields(input);
    return this.change(d=>{
      const index=d.projects.findIndex(p=>p.id===projectID);assert(index>=0,'Project not found.',404);
      assert(d.projects[index].version===input.version,'This project changed in another tab. Reopen project details before saving.',409);
      assert(!d.projects.some(p=>p.id!==projectID&&p.folderPath===fields.folderPath),'This folder is already connected to a project.',409);
      assert(!d.projects[index].benchmark||d.projects[index].folderPath===fields.folderPath,'Disable benchmark reset before changing its folder.');
      const p={...fields,...(d.projects[index].benchmarkTask?{benchmarkTask:d.projects[index].benchmarkTask}:{}),...(d.projects[index].benchmark?{benchmark:d.projects[index].benchmark}:{}),id:projectID,version:input.version+1,updatedAt:now()};d.projects[index]=p;return p;
    });
  }
  setBenchmark(projectID,version,benchmark){return this.change(d=>{const p=d.projects.find(p=>p.id===projectID);assert(p&&p.folderPath,'Project not found.',404);assert(p.version===version,'Project changed. Reopen project details.',409);if(benchmark)p.benchmark=benchmark;else delete p.benchmark;p.version++;p.updatedAt=now();return p;});}
  saveRunSettings(flowID,input){return this.change(d=>{
    const f=d.flows.find(f=>f.id===flowID);assert(f,'Flow not found.',404);const p=d.projects.find(p=>p.id===f.projectID);
    assert(f.version===input.version&&p.version===input.projectVersion,'Flow or project changed. Reopen run settings.',409);
    const steps=f.steps.map(s=>s.type==='agent'&&input.config?.[s.id]?{...s,model:input.config[s.id].model,effort:input.config[s.id].effort,...(input.config[s.id].agentProfile!==undefined?{agentProfile:input.config[s.id].agentProfile}:{}),skills:input.config[s.id].skills||s.skills||{mode:'inherit',skillIDs:[]}}:s);
    const validated=validateFlow({...f,steps,runSettings:input.settings});assert(validated.runSettings,'Run settings required.');
    Object.assign(f,validated,{version:f.version+1,updatedAt:now()});
    if(p.benchmark){p.benchmarkTask={task:f.runSettings.task,acceptance:f.runSettings.acceptance};p.version++;p.updatedAt=now();}
    return {flow:f,project:p};
  });}
  createFlow(input) {
    const projectID=input.projectID??'unassigned';this.project(projectID);
    const flow = {...validateFlow(input),projectID,id:id(),version:1,updatedAt:now()};
    return this.change(d=>{ d.flows.push(flow); return flow; });
  }
  updateFlow(flowID,input) {
    return this.change(d=>{
      const index = d.flows.findIndex(f=>f.id===flowID);
      assert(index>=0,'Flow no longer exists. Reload to see current flows.',404);
      assert(d.flows[index].version===input.version,'This flow changed in another tab. Copy your edits, then reload before saving.',409);
      const projectID=input.projectID??d.flows[index].projectID;
      assert(d.projects.some(p=>p.id===projectID),'Project not found.',404);
      const flow = {...validateFlow(input),projectID,id:flowID,version:input.version+1,updatedAt:now()};
      d.flows[index]=flow; return flow;
    });
  }
  deleteFlow(flowID,version) {
    return this.change(d=>{
      const flow=d.flows.find(f=>f.id===flowID);
      assert(flow,'Flow not found.',404);
      assert(flow.version===version,'This flow changed. Reload before deleting.',409);
      d.flows=d.flows.filter(f=>f.id!==flowID); return {ok:true};
    });
  }
  createRun(input, sourceContext=null, expectedProjectVersion=null, issueSnapshots={}) {
    return this.change(d=>{
      const flow=d.flows.find(f=>f.id===input.flowID);
      assert(flow,'Flow not found.',404);
      const project=d.projects.find(p=>p.id===flow.projectID);
      assert(project,'Project not found.',404);
      if(project.folderPath){
        assert(expectedProjectVersion===project.version,'Project connection changed. Reload before starting.',409);
        assert(sourceContext?.folderPath===project.folderPath&&sourceContext?.available,'Project folder could not be inspected. Reconnect it before starting.');
      }
      const run=createRun(flow,input,project,sourceContext,issueSnapshots);
      d.runs.push(run);return run;
    });
  }
  transition(runID,input) {
    return this.change(d=>{
      const run=d.runs.find(r=>r.id===runID);
      assert(run,'Run not found.',404);
      return transition(run,input);
    });
  }
}

function unassigned(){return {id:'unassigned',name:'Unassigned',folderPath:null,version:1};}
function projectFields(input){
  assert(typeof input.name==='string'&&input.name.trim()&&input.name.length<=100,'Project name is required (up to 100 characters).');
  assert(typeof input.folderPath==='string'&&input.folderPath.length<=4096&&path.isAbsolute(input.folderPath)&&!input.folderPath.includes('\0'),'Choose an absolute folder path.');
  return {name:input.name.trim(),folderPath:input.folderPath};
}
