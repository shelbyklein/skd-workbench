import {z} from 'zod';
import {assert} from './domain.js';
const id=z.string().min(1).max(100),revision=z.number().int().nonnegative(),data=z.record(z.unknown());
const project={projectID:id},page={cursor:z.number().int().nonnegative().optional(),limit:z.number().int().min(1).max(50).optional()};
const flow={...project,flowID:id},run={...project,runID:id};
const launch={...flow,projectVersion:revision,flowVersion:revision,input:data};
export const controllerTools=[
 ['get_workbench_status','read',{},'Read controller capabilities and whether execution is busy.'],
 ['list_projects','read',page,'List granted projects.'],
 ['get_project','read',project,'Read a granted project and its version.'],
 ['list_workflows','read',{...project,...page},'List saved workflows in this project.'],
 ['get_workflow','read',flow,'Read a saved workflow and version.'],
 ['create_workflow','manage',{...project,requestKey:id,input:data},'Create a saved workflow with a durable request key. Input uses the canonical flow schema: name and steps.'],
 ['update_workflow','manage',{...flow,requestKey:id,version:revision,input:data},'Update a saved workflow at an expected version.'],
 ['get_project_mandate','read',project,'Read this project’s owner mandate: owner Agent, eligible tasks and workflows, permitted modes, limits and whether it is active. Mandates are changed only by the user in Workbench.'],
 ['list_agents','read',{...project,...page},'List eligible Agent summaries without their prompts or connection secrets.'],
 ['preview_run','read',launch,'Preview launch input (task, acceptance, mode, maxAttempts, per-step config). Return a fingerprint required by start_run.'],
 ['start_run','run',{...launch,requestKey:id,previewToken:id},'Start the exact previewed workflow. Returns a durable operation; inspect get_operation and get_run for progress.'],
 ['get_operation','read',{...project,operationID:id},'Recover a controller-owned mutation outcome.'],
 ['get_run','read',{...run,...page},'Read run status and paginated, bounded attempt output. Human gates require the user.'],
 ['list_runs','read',{...project,...page},'List canonical workflow runs.'],
 ['stop_run','run',{...run,revision,requestKey:id},'Stop this controller’s run at its current revision.'],
 ['get_workspace_status','read',{...project,...page},'Read registered workspace status for this project.'],
].map(([name,capability,shape,description])=>({name,capability,shape,description,schema:z.object(shape).strict()}));
export function validateCommand(name,input){
 const tool=controllerTools.find(t=>t.name===name);assert(tool,'Unknown controller tool.',404);
 assert(Buffer.byteLength(JSON.stringify(input??{}))<=128*1024,'Controller input exceeds 128 KiB.',413);
 const parsed=tool.schema.safeParse(input??{});assert(parsed.success,'Invalid controller arguments: '+(parsed.error?.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')||''));
 return {tool,input:parsed.data};
}
