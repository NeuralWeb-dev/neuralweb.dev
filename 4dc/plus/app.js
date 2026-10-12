const $ = id => document.getElementById(id);
const examples = {
  climate: ['Which California counties are most vulnerable to climate change?', 'California counties'],
  gasoline: ['Where would a sharp increase in gasoline prices hurt residents most?', 'US counties'],
  transit: ['Where would expanding public transit make the greatest difference?', 'US counties'],
  heat: ['Which Texas counties are most at risk during extreme heat?', 'Texas counties'],
  housing: ['Which US states face the biggest housing affordability problem?', 'US states'],
  health: ['Where are residents least able to get health care when they need it?', 'US states'],
  rural: ['Which Midwest counties are losing population fastest, and why might that be?', 'Midwest counties'],
  childcare: ['Which New York counties would benefit most from child-care support?', 'New York counties'],
  broadband: ['Which US counties have the biggest gap in home internet access?', 'US counties'],
  retirees: ['Which US states are best for retirees on a modest income?', 'US states']
};
let record = null;
function el(tag, text, cls) { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; }
function title(parent, number, text) { parent.append(el('p', number, 'number'), el('h2', text)); }
function citations(parent, ids) { for (const id of ids || []) { const a = el('a', id, 'source-link'); a.href = '#source-' + id; a.addEventListener('click',()=>{const source=$('source-'+id);if(source)source.open=true;}); parent.append(a); } }
function renderPlan(plan, repair=false) {
  if (!repair) { $('plan').replaceChildren(); title($('plan'), '01 / REASONING', 'Which evidence would help?'); $('plan').append(el('p', plan.approach)); }
  else $('plan').append(el('h3', 'Alternative measures'));
  for (const q of plan.questions) { const p=el('p', q.question); p.append(el('small', ' — ' + q.why)); $('plan').append(p); }
}
function renderRaw(results) {
  $('raw').replaceChildren(); title($('raw'), '04 / SOURCES', 'What came back from Data Commons');
  for (const r of results) {
    const d=el('details'); d.id='source-'+r.id;
    d.append(el('summary', `${r.id} · ${r.claims.length ? 'Evidence retrieved' : 'No evidence'} · ${r.question}`));
    const claims=el('div',null,'claims');
    for (const c of r.claims) claims.append(el('p',c));
    for (const c of [...r.disclosures,...r.failures,...(r.error ? [r.error] : [])]) claims.append(el('p',c,'qualification'));
    if (!r.claims.length) claims.prepend(el('p','No statistical claims returned.'));
    d.append(claims); $('raw').append(d);
  }
}
function renderResult(data) {
  record=data; const o=data.opinion;
  $('facts').replaceChildren(); title($('facts'),'02 / EVIDENCE','The available facts');
  for (const f of o.available_evidence) { const p=el('p',f.finding,'finding'); citations(p,f.sources); $('facts').append(p); }
  if (!o.available_evidence.length) $('facts').append(el('p','No relevant statistical evidence was retrieved. The opinion below is conceptual.'));
  $('opinion').replaceChildren(); title($('opinion'),'03 / JUDGMENT','A provisional opinion');
  $('opinion').append(el('p',`${o.basis} · ${o.confidence} confidence (model assessment)`,'tag'),el('p',o.opinion,'opinion-text'));
  for (const c of o.candidate_places) { const p=el('p',c.reason); citations(p,c.sources); $('opinion').append(el('h3',c.place),p); }
  for (const [label,items] of [['Assumptions behind the opinion',o.assumptions],['What could change this opinion',o.important_gaps]]) {
    $('opinion').append(el('h3',label)); const ul=el('ul'); for(const item of items) ul.append(el('li',item)); $('opinion').append(ul);
  }
  $('opinion').append(el('h3','Most useful next evidence'),el('p',o.most_useful_next_data));
  for (const w of data.warnings) $('opinion').append(el('p',w,'qualification'));
  renderRaw(data.results); $('download').hidden=false;
  $('status').textContent=`Complete · ${data.meta.seconds}s · ${data.results.filter(r=>r.claims.length).length} of ${data.results.length} retrieval replies contain evidence · ${data.meta.tested_at}`;
}
function event(e) {
  if (e.message) $('status').textContent=e.message;
  if (e.plan) renderPlan(e.plan);
  if (e.repair_plan) renderPlan(e.repair_plan,true);
  if (e.results) renderRaw(e.results);
  if (e.stage==='done') renderResult(e.result);
  if (e.stage==='error') throw new Error(e.message);
}
$('ask').addEventListener('submit', async ev => {
  ev.preventDefault(); if ($('submit').disabled) return;
  $('submit').disabled=true; record=null; $('download').hidden=true; $('output').hidden=false;
  for (const id of ['plan','facts','opinion','raw']) $(id).replaceChildren();
  try {
    const endpoint = document.querySelector('meta[name="dcplus-api"]')?.content || location.origin;
    const response=await fetch(new URL('/ask',endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:$('question').value,scope:$('scope').value})});
    if (!response.ok) { const error=await response.json(); throw new Error(error.error || 'Request failed.'); }
    const reader=response.body.getReader(),decoder=new TextDecoder(); let pending='',done=false;
    while (true) { const chunk=await reader.read(); if(chunk.done) break; pending+=decoder.decode(chunk.value,{stream:true}); let newline;
      while((newline=pending.indexOf('\n'))>=0) { const line=pending.slice(0,newline);pending=pending.slice(newline+1);if(line){const e=JSON.parse(line);event(e);if(e.stage==='done')done=true;} }
    }
    if(!done) throw new Error('The connection ended before the opinion was ready. Any retrieved evidence is shown below.');
  } catch(e) { $('status').textContent=e.message; }
  finally { $('submit').disabled=false; }
});
document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{const [q,s]=examples[b.dataset.example];$('question').value=q;$('scope').value=s;$('ask').requestSubmit();}));
$('download').addEventListener('click',()=>{if(!record)return;const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='dc-plus-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
