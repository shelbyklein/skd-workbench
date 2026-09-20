import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { assert, copy, id, now, seedFlows, validateFlow, createRun, transition } from './domain.js';
export class Store {
  constructor(directory) {
    mkdirSync(directory, {recursive:true});
    this.file = path.join(directory, 'store.json');
    if (existsSync(this.file)) {
      this.data = JSON.parse(readFileSync(this.file, 'utf8'));
      assert(this.data.schema === 1 && Array.isArray(this.data.flows) && Array.isArray(this.data.runs), 'Unsupported or damaged store. Restore a backup before starting.');
    } else { this.data = {schema:1,flows:seedFlows(),runs:[]}; this.persist(this.data); }
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
  createFlow(input) {
    const flow = {...validateFlow(input),id:id(),version:1,updatedAt:now()};
    return this.change(d=>{ d.flows.push(flow); return flow; });
  }
  updateFlow(flowID,input) {
    return this.change(d=>{
      const index = d.flows.findIndex(f=>f.id===flowID);
      assert(index>=0,'Flow no longer exists. Reload to see current flows.',404);
      assert(d.flows[index].version===input.version,'This flow changed in another tab. Copy your edits, then reload before saving.',409);
      const flow = {...validateFlow(input),id:flowID,version:input.version+1,updatedAt:now()};
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
  createRun(input) {
    return this.change(d=>{
      const run=createRun(d.flows.find(f=>f.id===input.flowID),input);
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
