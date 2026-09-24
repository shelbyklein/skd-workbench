// Tools (#20): what Codex and Claude Code can use in their normal setup, side by side, and Install MCP server,
// which runs each CLI's own `mcp add` after showing the exact command. Reading changes nothing.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={codex:'Codex',claude:'Claude Code'},sources={user:'user',system:'system',plugin:'plugin',project:'project'};

export function mountTools({host,projectID=null,projects,api,modal,notify,onProject}){
 let data=null,query='',token=0;
 host.innerHTML=`<div class="tools-bar"><label class="tools-search">Search<input type="search" id="tools-search" placeholder="Skill or server"></label>
  <label>Project skills<select id="tools-project"><option value="">None</option>${projects.filter(p=>p.id!=='unassigned'&&p.folderPath).map(p=>`<option value="${esc(p.id)}"${p.id===projectID?' selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
  <button type="button" id="tools-refresh">Refresh</button><button type="button" class="primary" id="tools-install">Install MCP server…</button></div>
  <p class="field-help" id="tools-status" role="status">Loading…</p><div class="tools-columns" id="tools-columns"></div>`;
 const q=s=>host.querySelector(s);
 const match=(...values)=>!query||values.some(v=>String(v||'').toLowerCase().includes(query));
 function column(provider){
  const c=data[provider],mcp=c.mcp.filter(m=>match(m.name,m.transport,m.source)),skills=c.skills.filter(s=>match(s.name,s.description,s.plugin));
  const mcpRows=mcp.map(m=>`<li><details><summary><strong>${esc(m.name)}</strong><span class="tools-meta">${esc(m.transport)} · ${m.enabled?'on':'off'}${m.shadowed?' · overridden':''}</span></summary><dl class="tools-detail"><div><dt>Source</dt><dd>${esc(m.source)} · ${esc(m.sourcePath)}</dd></div>${m.environmentNames.length?`<div><dt>Environment</dt><dd>${esc(m.environmentNames.join(', '))}</dd></div>`:''}${m.inlineCredentials?'<div><dt>Credentials</dt><dd>Inline credential in config (hidden)</dd></div>':''}</dl></details></li>`).join('');
  const skillRows=skills.map(s=>`<li><details><summary><strong>${esc(s.name)}</strong><span class="tools-meta">${esc(sources[s.source]||s.source)}${s.both?' · both':''}</span></summary>${s.description?`<p>${esc(s.description)}</p>`:''}${s.status==='unreadable'?'<p class="field-help">SKILL.md could not be read.</p>':''}</details></li>`).join('');
  return `<section class="tools-column" aria-labelledby="tools-${provider}"><h2 id="tools-${provider}">${labels[provider]}</h2>
   <h3>MCP servers <span>${mcp.length}</span></h3><ul class="tools-list">${mcpRows||'<li class="widget-empty">No MCP servers.</li>'}</ul>
   <h3>Skills <span>${skills.length}</span></h3><ul class="tools-list">${skillRows||'<li class="widget-empty">No skills.</li>'}</ul></section>`;
 }
 function render(){if(!data)return;q('#tools-columns').innerHTML=column('codex')+column('claude');}
 async function load(){
  const mine=++token,id=q('#tools-project').value;q('#tools-status').textContent='Loading…';
  try{const next=await api('tools'+(id?'?projectID='+encodeURIComponent(id):''));if(mine!==token||!host.isConnected)return;data=next;
   q('#tools-status').textContent=[`Sessions use each CLI's own setup.`,id?`Includes ${projects.find(p=>p.id===id)?.name||'project'} repo skills.`:'',...(data.diagnostics||[]).slice(0,3)].filter(Boolean).join(' ');render();}
  catch(error){if(mine===token&&host.isConnected)q('#tools-status').textContent=error.message;}
 }
 q('#tools-search').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
 q('#tools-project').onchange=e=>{onProject?.(e.target.value||null);load();};
 q('#tools-refresh').onclick=()=>load();
 q('#tools-install').onclick=()=>openInstall({api,modal,notify,onDone:load});
 load();
 return {refresh:load,dispose(){token++;}};
}

// Two steps in one dialog: describe the server, then review the exact commands and install.
export function openInstall({api,modal,notify,onDone}){
 modal('Install MCP server',`<div class="tools-install">
  <fieldset><legend>Install into</legend><label class="agent-check"><input type="checkbox" name="providers" value="codex" checked> Codex</label><label class="agent-check"><input type="checkbox" name="providers" value="claude" checked> Claude Code</label></fieldset>
  <label>Name<input name="name" required maxlength="64" pattern="[A-Za-z0-9_-]+" placeholder="my-server" autocomplete="off"></label>
  <fieldset><legend>Runs as</legend><label class="agent-check"><input type="radio" name="transport" value="stdio" checked> Local command</label><label class="agent-check"><input type="radio" name="transport" value="http"> URL (HTTP)</label></fieldset>
  <div data-stdio><label>Command<input name="command" placeholder="npx" autocomplete="off"></label><label>Arguments<input name="args" placeholder="-y @scope/server" autocomplete="off"><span class="field-help">Separated by spaces; quote an argument that contains spaces.</span></label><label>Environment<textarea name="env" rows="2" placeholder="API_KEY=value" autocomplete="off"></textarea><span class="field-help">One NAME=value per line. Values go only to the CLI's config and are hidden here.</span></label></div>
  <div data-http hidden><label>URL<input name="url" type="url" placeholder="https://example.com/mcp" autocomplete="off"></label><label>Bearer token variable<input name="bearerTokenEnv" placeholder="EXAMPLE_TOKEN" autocomplete="off"><span class="field-help">Optional. The name of an environment variable holding the token, not the token.</span></label></div>
  <div data-review hidden></div></div>`,[{label:'Cancel',close:true},{label:'Review commands',submit:true,primary:true}],async form=>{
   const d=document.querySelector('#dialog'),review=d.querySelector('[data-review]'),submit=d.querySelector('[type=submit]');
   const input=readInput(form);
   if(review.hidden||review.dataset.key!==JSON.stringify(input)){
    const plan=await api('tools/mcp/preview','POST',input);
    review.innerHTML=`<h3>These commands will run</h3>${plan.commands.map(c=>`<div class="tools-command"><strong>${esc(labels[c.provider])}</strong><code>${esc(c.command)}</code><span class="field-help">Changes ${esc(c.file)}. Undo: <code>${esc(c.remove)}</code></span></div>`).join('')}`;
    review.hidden=false;review.dataset.key=JSON.stringify(input);submit.textContent='Install';review.scrollIntoView({block:'nearest'});
    throw Object.assign(new Error(''),{keepOpen:true});
   }
   const result=await api('tools/mcp/install','POST',{...input,confirm:true});
   const failed=result.results.filter(r=>!r.ok);
   notify(failed.length?`${result.name}: ${failed.map(r=>`${labels[r.provider]} failed — ${r.output.split('\n')[0]}`).join('; ')}`:`${result.name} installed in ${result.results.map(r=>labels[r.provider]).join(' and ')}.`);
   onDone?.();
  });
 const d=document.querySelector('#dialog'),sync=()=>{const http=d.querySelector('[name=transport]:checked').value==='http';d.querySelector('[data-stdio]').hidden=http;d.querySelector('[data-http]').hidden=!http;};
 d.querySelectorAll('[name=transport]').forEach(r=>r.onchange=sync);
 // Editing after a review asks for a fresh review before anything runs.
 d.querySelector('.tools-install').addEventListener('input',()=>{const review=d.querySelector('[data-review]');if(!review.hidden){review.hidden=true;d.querySelector('[type=submit]').textContent='Review commands';}});
}
function splitArgs(text){const out=[];let cur='',quote=null,any=false;for(const ch of text){if(quote){if(ch===quote)quote=null;else cur+=ch;}else if(ch==='"'||ch==="'"){quote=ch;any=true;}else if(/\s/.test(ch)){if(cur||any)out.push(cur);cur='';any=false;}else cur+=ch;}if(cur||any)out.push(cur);return out;}
function readInput(form){
 const transport=form.get('transport'),base={providers:form.getAll('providers'),name:String(form.get('name')||'').trim(),transport};
 if(transport==='http'){const bearer=String(form.get('bearerTokenEnv')||'').trim();return {...base,url:String(form.get('url')||'').trim(),...(bearer?{bearerTokenEnv:bearer}:{})};}
 const env={};for(const line of String(form.get('env')||'').split('\n')){const t=line.trim();if(!t)continue;const i=t.indexOf('=');env[i<0?t:t.slice(0,i).trim()]=i<0?'':t.slice(i+1);}
 return {...base,command:String(form.get('command')||'').trim(),args:splitArgs(String(form.get('args')||'')),env};
}
