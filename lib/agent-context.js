import {existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {instructionFiles} from './settings.js';
import {assert} from './domain.js';
// Preserve provider identity in `agent`; specialization is a separate selection.
export function profileSelection(input){
 if(input.agentProfile&&input.playbook)assert(JSON.stringify(input.agentProfile)===JSON.stringify(input.playbook),'Conflicting Agent and legacy playbook selections.');
 return input.agentProfile||input.playbook||{mode:'legacy',skills:input.skills,connections:input.connections};
}
export function deliveredInstructions(context={}){
 const profile=context.agentProfile||context.playbook;
 let entryInstructions=context.systemInstructions||'';for(const section of profile?.instructionSections||[])entryInstructions=entryInstructions.replace(section.text,'');entryInstructions=entryInstructions.trim();
 const sections=[...(profile?.instructionSections||[]),profile?.systemPrompt?{source:'Agent specialization',text:profile.systemPrompt}:null,context.skills?.text?{source:'Managed skills',text:context.skills.text}:null,entryInstructions?{source:'Workbench, project and entry-point instructions',text:entryInstructions}:null].filter(Boolean);
 const text=sections.map(section=>section.source==='Agent specialization'?section.source+':\n'+section.text:section.text).join('\n\n');
 assert(Buffer.byteLength(JSON.stringify(text))<=96*1024,'Combined Agent instructions exceed 96 KiB. Reduce the instruction sections.');
 return text;
}

export async function profileInstructions(project,provider){
 const roots=[['Workbench',fileURLToPath(new URL('../',import.meta.url))],['Project',project.folderPath]],seen=new Set(),sections=[];
 const names=new Set(['SYSTEM.md','system.md','system-prompt.md','AGENTS.md',...(provider==='codex'?['AGENTS.override.md','.codex/AGENTS.md']:['CLAUDE.md','.claude/CLAUDE.md'])]);
 for(const [label,folder] of roots){if(!folder||!existsSync(folder))continue;const {files}=await instructionFiles(folder);for(const file of files.filter(f=>names.has(f.name))){assert(!file.error,`${label} ${file.name}: ${file.error}`);const canonical=realpathSync(path.join(folder,file.name));if(seen.has(canonical))continue;seen.add(canonical);sections.push({source:label+' instructions ('+file.name+')',text:label+' instructions ('+file.name+'):\n'+file.content});}}
 return sections;
}
