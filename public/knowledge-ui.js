const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

export function mountKnowledgeHome({host,projects,api,onOpen}){
 let disposed=false;
 host.innerHTML=`<div class="knowledge-intro"><div><span class="eyebrow">GRAFT INDEXES</span><h2>Projects</h2></div><p>Select a project to inspect its code, context, and outline graph.</p></div><div class="overview-grid knowledge-projects">${projects.map(project=>`<button class="overview-flow knowledge-project" data-knowledge-project="${esc(project.id)}"><span class="eyebrow" data-graft-status>CHECKING</span><strong>${esc(project.name)}</strong><span>${esc(project.folderPath||'No project folder connected.')}</span><span class="overview-flow-footer" data-graft-summary>Check Graft index</span></button>`).join('')||'<p class="overview-empty">No projects. Add a connected project from Home.</p>'}</div>`;
 host.querySelectorAll('[data-knowledge-project]').forEach(button=>button.onclick=()=>onOpen(button.dataset.knowledgeProject));
 Promise.allSettled(projects.map(async project=>{
  const card=host.querySelector(`[data-knowledge-project="${CSS.escape(project.id)}"]`);if(!card)return;
  try{
   const result=await api(`projects/${encodeURIComponent(project.id)}/graft?view=summary`);if(disposed||!card.isConnected)return;
   card.querySelector('[data-graft-status]').textContent=result.available?'CONNECTED':'NOT CONNECTED';
   card.querySelector('[data-graft-summary]').textContent=result.available?`${result.totals.codeNodes} code nodes · ${result.totals.codeEdges} relations`:(result.message||'No Graft index');
  }catch(error){if(!disposed&&card.isConnected){card.querySelector('[data-graft-status]').textContent='UNAVAILABLE';card.querySelector('[data-graft-summary]').textContent=error.message;}}
 }));
 return {dispose(){disposed=true;}};
}

export function mountKnowledgeProject({host,project,api,notify}){
 let disposed=false,request=0,tab='code',result=null,selectedID=null,cy=null,resize=null,themeObserver=null,searchTimer=null;
 host.innerHTML=`<div class="knowledge-tabs" role="tablist" aria-label="Knowledge Graph views"><button role="tab" aria-selected="true">Graft</button><button role="tab" aria-selected="false" disabled>Orchestration <span>Planned</span></button></div><section class="graft-shell"><header class="graft-header"><div><span class="eyebrow">CONNECTED INDEX</span><h2>${esc(project.name)}</h2><p id="graft-index-summary" aria-live="polite">Reading Graft…</p></div><div class="graft-diagnostics" id="graft-diagnostics"></div></header><div class="graft-tabs" role="tablist" aria-label="Graft graph"><button role="tab" data-graft-tab="code">Code</button><button role="tab" data-graft-tab="context">Context</button><button role="tab" data-graft-tab="outline">Outline</button></div><form class="graft-controls" id="graft-controls" role="search"><label><span>Search nodes</span><input type="search" id="graft-search" placeholder="File, symbol, or summary"></label><label><span>Node type</span><select id="graft-kind"><option value="">All types</option></select></label><label><span>Relation</span><select id="graft-relation"><option value="">All relations</option></select></label><button type="submit">Search</button></form><div class="graft-status" id="graft-status" role="status" aria-live="polite"></div><div class="graft-workspace"><section class="graft-visual" aria-label="Graft visualization"><div class="graft-toolbar"><span id="graft-visible-count"></span><div><button type="button" id="graft-zoom-out" aria-label="Zoom out">−</button><button type="button" id="graft-fit">Fit</button><button type="button" id="graft-zoom-in" aria-label="Zoom in">+</button></div></div><div id="graft-canvas" role="img" aria-label="Interactive Graft graph"></div><div id="graft-outline" hidden></div></section><aside class="graft-inspector" aria-label="Graft details"><section id="graft-details"><p>Select a node or relation to inspect it.</p></section><section class="graft-node-list"><div class="graft-side-heading"><h3>Visible nodes</h3><span id="graft-list-count"></span></div><div id="graft-list"></div></section></aside></div></section>`;
 const status=host.querySelector('#graft-status'),summary=host.querySelector('#graft-index-summary'),diagnostics=host.querySelector('#graft-diagnostics'),canvas=host.querySelector('#graft-canvas'),outline=host.querySelector('#graft-outline'),details=host.querySelector('#graft-details'),list=host.querySelector('#graft-list');
 const controls={search:host.querySelector('#graft-search'),kind:host.querySelector('#graft-kind'),relation:host.querySelector('#graft-relation')};

 const disposeGraph=()=>{resize?.disconnect();resize=null;themeObserver?.disconnect();themeObserver=null;cy?.destroy();cy=null;};
 const colors=()=>{const style=getComputedStyle(document.documentElement);return {ink:style.getPropertyValue('--ink').trim()||'#222',paper:style.getPropertyValue('--paper').trim()||'#fff',line:style.getPropertyValue('--line').trim()||'#ccc',accent:style.getPropertyValue('--accent').trim()||'#b55432'};};
 const graphStyle=()=>{const color=colors();return [
  {selector:'node',style:{'background-color':color.paper,'border-color':color.line,'border-width':2,'label':'data(label)','color':color.ink,'font-size':10,'text-wrap':'ellipsis','text-max-width':110,'text-valign':'bottom','text-margin-y':7,'width':24,'height':24}},
  {selector:'node[type="file"]',style:{'background-color':'#7e946e','border-color':'#5f7454','shape':'round-rectangle','width':34,'height':28}},
  {selector:'node[type="class"],node[type="interface"],node[type="type"]',style:{'background-color':'#d39a63','border-color':'#a86d38','shape':'diamond'}},
  {selector:'node[type="function"],node[type="method"]',style:{'background-color':'#7e9bad','border-color':'#56788c'}},
  {selector:'node:selected',style:{'border-color':color.accent,'border-width':4,'background-color':color.accent,'color':color.ink,'z-index':20}},
  {selector:'edge',style:{'line-color':color.line,'target-arrow-color':color.line,'target-arrow-shape':'triangle','curve-style':'bezier','width':1.2,'opacity':.72}},
  {selector:'edge:selected',style:{'line-color':color.accent,'target-arrow-color':color.accent,'width':3,'opacity':1}}
 ];};
 const graphElements=value=>[
  ...value.nodes.map(node=>({data:{id:node.id,label:node.name,type:node.type,node}})),
  ...value.edges.map((edge,index)=>({data:{id:`edge-${index}-${edge.source}-${edge.target}`,source:edge.source,target:edge.target,relation:edge.relation,confidence:edge.confidence||'',description:edge.description||''}}))
 ];
 const currentNode=id=>result?.nodes.find(node=>node.id===id);
 const relationRows=id=>result?.edges.filter(edge=>edge.source===id||edge.target===id).map(edge=>{const outgoing=edge.source===id,target=currentNode(outgoing?edge.target:edge.source);return `<li><span aria-hidden="true">${outgoing?'→':'←'}</span><button type="button" data-select-node="${esc(target?.id||'')}">${esc(label(edge.relation))} ${esc(target?.name||target?.id||'Unknown')}</button>${edge.confidence?`<small>${esc(edge.confidence)}</small>`:''}</li>`;}).join('')||'<li>No visible relations</li>';
 const renderNodeDetails=node=>{
  if(!node){details.innerHTML='<p>Select a node or relation to inspect it.</p>';return;}
  selectedID=node.id;
  details.innerHTML=`<div class="graft-detail-heading"><span class="graft-kind">${esc(label(node.type))}</span><h3>${esc(node.name)}</h3><code>${esc(node.id)}</code></div>${node.signature?`<p class="graft-signature"><code>${esc(node.signature)}</code></p>`:''}${node.summary?`<p>${esc(node.summary)}</p>`:''}${node.path?`<dl><div><dt>File</dt><dd>${esc(node.path)}</dd></div><div><dt>Span</dt><dd>${esc(node.span)}</dd></div><div><dt>Exported</dt><dd>${node.exported?'Yes':'No'}</dd></div></dl>`:''}${node.sources?.length?`<div class="graft-sources"><h4>Sources</h4><ul>${node.sources.map(source=>`<li>${esc(source)}</li>`).join('')}</ul></div>`:''}<div class="graft-detail-actions"><button type="button" id="graft-expand">Expand neighborhood</button></div><div class="graft-relations"><h4>Visible relations</h4><ul>${relationRows(node.id)}</ul></div>`;
  details.querySelector('#graft-expand').onclick=()=>{controls.search.value='';controls.kind.value='';load({focus:node.id});};
  details.querySelectorAll('[data-select-node]').forEach(button=>button.onclick=()=>selectNode(button.dataset.selectNode,true));
  list.querySelectorAll('[data-graft-node]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.graftNode===node.id)));
 };
 const renderEdgeDetails=edge=>{selectedID=null;details.innerHTML=`<div class="graft-detail-heading"><span class="graft-kind">RELATION</span><h3>${esc(label(edge.relation))}</h3></div><dl><div><dt>From</dt><dd>${esc(currentNode(edge.source)?.name||edge.source)}</dd></div><div><dt>To</dt><dd>${esc(currentNode(edge.target)?.name||edge.target)}</dd></div><div><dt>Confidence</dt><dd>${esc(edge.confidence||'Not supplied')}</dd></div></dl>${edge.description?`<p>${esc(edge.description)}</p>`:''}`;list.querySelectorAll('[data-graft-node]').forEach(button=>button.setAttribute('aria-pressed','false'));};
 const selectNode=(id,center=false)=>{const node=currentNode(id);if(!node)return;cy?.nodes().unselect();const graphNode=cy?.getElementById(id);if(graphNode?.length){graphNode.select();if(center)cy.animate({center:{eles:graphNode},duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:180});}renderNodeDetails(node);list.querySelector(`[data-graft-node="${CSS.escape(id)}"]`)?.scrollIntoView({block:'nearest'});};
 const renderList=()=>{host.querySelector('#graft-list-count').textContent=String(result.nodes.length);list.innerHTML=result.nodes.length?result.nodes.map(node=>`<button type="button" class="graft-list-node" data-graft-node="${esc(node.id)}" aria-pressed="${node.id===selectedID}"><span><strong>${esc(node.name)}</strong><small>${esc(label(node.type))}</small></span><code>${esc(node.path||node.id)}</code></button>`).join(''):'<p class="graft-empty">No nodes match these filters.</p>';list.querySelectorAll('[data-graft-node]').forEach(button=>button.onclick=()=>selectNode(button.dataset.graftNode,true));};
 const renderOutline=()=>{const groups=new Map();for(const node of result.nodes){const key=node.path||node.sources?.[0]||'Context';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);}outline.innerHTML=`<div class="graft-outline-list">${[...groups].map(([pathValue,nodes])=>`<section><h3>${esc(pathValue)}</h3><ul>${nodes.map(node=>`<li><button type="button" data-outline-node="${esc(node.id)}"><span>${esc(node.name)}</span><small>${esc(label(node.type))}${node.span?' · '+esc(node.span):''}</small></button></li>`).join('')}</ul></section>`).join('')||'<p>No outline nodes match these filters.</p>'}</div>`;outline.querySelectorAll('[data-outline-node]').forEach(button=>button.onclick=()=>selectNode(button.dataset.outlineNode));};
 const renderGraph=()=>{
  disposeGraph();canvas.hidden=tab==='outline';outline.hidden=tab!=='outline';host.querySelector('.graft-toolbar').hidden=tab==='outline';
  if(tab==='outline'){renderOutline();return;}
  if(!window.cytoscape){status.textContent='The graph renderer is unavailable. Use the visible node list to browse this index.';return;}
  cy=window.cytoscape({container:canvas,elements:graphElements(result),style:graphStyle(),wheelSensitivity:.18,minZoom:.25,maxZoom:3,layout:result.focus?{name:'concentric',animate:false,fit:true,padding:42,concentric:node=>node.id()===result.focus?100:node.degree(),levelWidth:()=>2}:{name:tab==='context'?'circle':'cose',animate:false,fit:true,padding:42,randomize:true,nodeRepulsion:120000,idealEdgeLength:90}});
  cy.on('tap','node',event=>selectNode(event.target.id()));cy.on('tap','edge',event=>renderEdgeDetails(event.target.data()));
  resize=new ResizeObserver(()=>cy?.resize());resize.observe(canvas);
  themeObserver=new MutationObserver(()=>{if(cy){cy.style(graphStyle());cy.style().update();}});themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 };
 const renderFacets=()=>{
  const previousKind=controls.kind.value,previousRelation=controls.relation.value;
  controls.kind.innerHTML='<option value="">All types</option>'+result.facets.kinds.map(kind=>`<option value="${esc(kind)}">${esc(label(kind))}</option>`).join('');controls.kind.value=result.facets.kinds.includes(previousKind)?previousKind:'';
  controls.relation.innerHTML='<option value="">All relations</option>'+result.facets.relations.map(relation=>`<option value="${esc(relation)}">${esc(label(relation))}</option>`).join('');controls.relation.value=result.facets.relations.includes(previousRelation)?previousRelation:'';
 };
 const renderResult=()=>{
  summary.textContent=`${result.totals.codeNodes} code nodes · ${result.totals.codeEdges} relations${result.totals.contextNodes?` · ${result.totals.contextNodes} context nodes`:''}`;
  const notices=[];if(result.diagnostics.codeDroppedEdges)notices.push(`${result.diagnostics.codeDroppedEdges} dangling code relation${result.diagnostics.codeDroppedEdges===1?'':'s'} omitted`);if(result.diagnostics.contextSkippedFiles)notices.push(`${result.diagnostics.contextSkippedFiles} context file${result.diagnostics.contextSkippedFiles===1?'':'s'} skipped`);diagnostics.textContent=notices.join(' · ');
  host.querySelectorAll('[data-graft-tab]').forEach(button=>{const active=button.dataset.graftTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  host.querySelector('#graft-visible-count').textContent=`${result.nodes.length} visible`;status.textContent=result.truncated?'Showing a bounded view. Search or select a node to narrow the graph.':'';
  if(!selectedID||!result.nodes.some(node=>node.id===selectedID))selectedID=result.focus||result.nodes[0]?.id||null;
  renderFacets();renderList();renderGraph();renderNodeDetails(currentNode(selectedID));
 };
 async function load({focus='',clearFocus=false}={}){
  const token=++request;status.textContent='Loading graph…';host.querySelector('.graft-shell').setAttribute('aria-busy','true');
  const params=new URLSearchParams({tab,query:controls.search.value,kind:controls.kind.value,relation:controls.relation.value,limit:tab==='outline'?'1000':'180'});if(focus&&!clearFocus)params.set('focus',focus);
  try{
   const next=await api(`projects/${encodeURIComponent(project.id)}/graft?${params}`);if(disposed||token!==request)return;
   if(!next.available){disposeGraph();host.querySelector('.graft-shell').innerHTML=`<div class="knowledge-loading"><h2>Graft is not connected</h2><p>${esc(next.message)}</p></div>`;return;}
   result=next;tab=next.tab;selectedID=focus||selectedID;renderResult();
  }catch(error){if(!disposed&&token===request){disposeGraph();status.textContent=error.message;notify?.(error.message);}}
  finally{if(!disposed&&token===request)host.querySelector('.graft-shell')?.removeAttribute('aria-busy');}
 }

 const tabButtons=[...host.querySelectorAll('[data-graft-tab]')];
 tabButtons.forEach(button=>button.onclick=()=>{tab=button.dataset.graftTab;selectedID=null;controls.search.value='';controls.kind.value='';controls.relation.value='';load({clearFocus:true});});
 host.querySelector('.graft-tabs').onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=Math.max(0,tabButtons.indexOf(document.activeElement)),next=event.key==='Home'?0:event.key==='End'?tabButtons.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabButtons.length)%tabButtons.length;tabButtons[next].focus();tabButtons[next].click();};
 host.querySelector('#graft-controls').onsubmit=event=>{event.preventDefault();selectedID=null;load({clearFocus:true});};
 controls.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{selectedID=null;load({clearFocus:true});},260);};
 controls.kind.onchange=controls.relation.onchange=()=>{selectedID=null;load({clearFocus:true});};
 host.querySelector('#graft-fit').onclick=()=>cy?.fit(undefined,42);host.querySelector('#graft-zoom-in').onclick=()=>cy?.zoom({level:Math.min(3,cy.zoom()*1.25),renderedPosition:{x:cy.width()/2,y:cy.height()/2}});host.querySelector('#graft-zoom-out').onclick=()=>cy?.zoom({level:Math.max(.25,cy.zoom()*.8),renderedPosition:{x:cy.width()/2,y:cy.height()/2}});
 api(`projects/${encodeURIComponent(project.id)}/graft?view=summary`).then(value=>{if(!disposed){tab=value.defaultTab||'code';load();}}).catch(error=>{if(!disposed){status.textContent=error.message;notify?.(error.message);}});
 return {dispose(){disposed=true;request++;clearTimeout(searchTimer);disposeGraph();}};
}
