'use strict';

const STORAGE_KEY = 'adc-figueiras-team-manager-v1';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad = n => String(n).padStart(2, '0');
const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const money = n => new Intl.NumberFormat('pt-PT', {style:'currency',currency:'EUR'}).format(Number(n)||0);
const fmtDate = iso => iso ? new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${iso}T12:00:00`)) : '—';
const fmtShort = iso => iso ? new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'short'}).format(new Date(`${iso}T12:00:00`)) : '—';
const nowKey = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };

const seedPlayers = [
  ['Batista','Jogador'],['David','Jogador'],['Rui Lopes','Jogador'],['João Barros','Jogador'],['Vítor Coelho','Jogador'],
  ['Diogo Bessa','Jogador'],['Pedrinho','Jogador'],['Zé Mocho','Jogador'],['Bruno Bessa','Jogador'],['Joãozinho','Jogador'],
  ['Marcelo','GR'],['João','GR'],['Manu','GR']
].map((p,i)=>({id:`p${i+1}`,name:p[0],position:p[1],number:'',status:'Disponível',birth:'',phone:'',notes:''}));

const defaultState = () => ({
  version:1,
  settings:{season:'2026/27', club:'ADC Figueiras'},
  players: seedPlayers.map(p=>({...p})),
  trainings:[],
  games:[],
  fines:[]
});

let state = loadState();
let currentView = 'dashboard';
let calendarCursor = new Date(); calendarCursor.setDate(1);
let toastTimer;

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {...defaultState(), ...parsed, settings:{...defaultState().settings,...(parsed.settings||{})}};
  }catch(e){ return defaultState(); }
}
function saveState(message){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  if(message) toast(message);
}
function toast(msg){
  const el=$('#toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}
function dateTimeOf(date,time='23:59'){ return new Date(`${date}T${time || '23:59'}:00`); }
function playerById(id){ return state.players.find(p=>p.id===id); }
function statusBadge(status){
  const map={Disponível:'green',Lesionado:'red',Castigado:'amber',Indisponível:'gray',Presente:'green',Atrasado:'amber',Falta:'red',Justificado:'blue','Não convocado':'gray',Convocado:'green'};
  return `<span class="badge ${map[status]||'gray'}">${esc(status)}</span>`;
}
function initials(name){ return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function playerHtml(p, small=false){ return `<div class="player"><div class="avatar ${small?'sm':''}">${esc(initials(p.name))}</div><div><strong>${esc(p.name)}</strong><small>${esc(p.position||'Jogador')}${p.number?` · #${esc(p.number)}`:''}</small></div></div>`; }
function empty(title, body=''){ return `<div class="empty"><b>${esc(title)}</b>${esc(body)}</div>`; }

const viewInfo = {
  dashboard:['Início','Resumo da equipa'], squad:['Plantel','Jogadores e disponibilidade'], training:['Treinos','Presenças e pesagens'],
  games:['Jogos','Convocatórias, resultados e estatísticas'], calendar:['Calendário','Agenda desportiva'], fines:['Multas','Registo e pagamentos'], settings:['Definições','Época, backups e dados']
};

function showView(view){
  currentView=view;
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(`#view-${view}`).classList.add('active');
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#pageTitle').textContent=viewInfo[view][0]; $('#pageSubtitle').textContent=viewInfo[view][1];
  $('#sidebar').classList.remove('open');
  renderView(view);
}
function renderAll(){
  $('#seasonLabel').textContent=state.settings.season;
  renderView(currentView);
}
function renderView(view){
  ({dashboard:renderDashboard,squad:renderSquad,training:renderTrainings,games:renderGames,calendar:renderCalendar,fines:renderFines,settings:renderSettings}[view]||(()=>{}))();
}

function attendanceRate(){
  let total=0,present=0;
  state.trainings.forEach(t=>{
    state.players.forEach(p=>{
      const st=t.entries?.[p.id]?.status;
      if(st){ total++; if(st==='Presente'||st==='Atrasado') present++; }
    });
  });
  return total ? Math.round(present/total*100) : 0;
}
function playerStats(){
  const base={}; state.players.forEach(p=>base[p.id]={goals:0,assists:0,yellow:0,red:0,games:0,callups:0});
  state.games.forEach(g=>Object.entries(g.roster||{}).forEach(([id,r])=>{
    if(!base[id])return; if(r.status==='Convocado') base[id].callups++;
    const s=r.stats||{}; base[id].goals+=Number(s.goals)||0; base[id].assists+=Number(s.assists)||0; base[id].yellow+=Number(s.yellow)||0; base[id].red+=Number(s.red)||0;
    if(r.status==='Convocado' && (g.homeScore!=='' || g.awayScore!=='')) base[id].games++;
  })); return base;
}
function renderDashboard(){
  const now=new Date();
  const nextTraining=[...state.trainings].filter(t=>dateTimeOf(t.date,t.time)>=now).sort((a,b)=>dateTimeOf(a.date,a.time)-dateTimeOf(b.date,b.time))[0];
  const nextGame=[...state.games].filter(g=>dateTimeOf(g.date,g.time)>=now).sort((a,b)=>dateTimeOf(a.date,a.time)-dateTimeOf(b.date,b.time))[0];
  const pending=state.fines.filter(f=>!f.paid).reduce((s,f)=>s+Number(f.amount||0),0);
  const unavailable=state.players.filter(p=>p.status!=='Disponível').length;
  const stats=playerStats();
  const scorers=state.players.map(p=>({p,...stats[p.id]})).sort((a,b)=>b.goals-a.goals||b.assists-a.assists).slice(0,5);
  const recent=[
    ...state.trainings.map(t=>({type:'training',date:t.date,time:t.time,title:'Treino',sub:t.location||'Sem local'})),
    ...state.games.map(g=>({type:'game',date:g.date,time:g.time,title:`${g.homeAway==='Casa'?'vs':'@'} ${g.opponent}`,sub:g.competition||'Jogo'})),
    ...state.fines.map(f=>({type:'fine',date:f.date,time:'',title:`Multa · ${playerById(f.playerId)?.name||'Jogador'}`,sub:`${f.reason} · ${money(f.amount)}`}))
  ].sort((a,b)=>dateTimeOf(b.date,b.time)-dateTimeOf(a.date,a.time)).slice(0,6);

  $('#view-dashboard').innerHTML=`
    <div class="grid kpis">
      <div class="card kpi"><div class="label">Plantel</div><div class="value">${state.players.length}</div><div class="sub">${unavailable?`${unavailable} indisponível(eis)`:'Todos disponíveis'}</div></div>
      <div class="card kpi"><div class="label">Assiduidade</div><div class="value accent">${attendanceRate()}%</div><div class="sub">Treinos registados</div></div>
      <div class="card kpi"><div class="label">Treinos</div><div class="value">${state.trainings.length}</div><div class="sub">Nesta base de dados</div></div>
      <div class="card kpi"><div class="label">Jogos</div><div class="value">${state.games.length}</div><div class="sub">Registados</div></div>
      <div class="card kpi"><div class="label">Multas pendentes</div><div class="value ${pending?'':'accent'}">${money(pending)}</div><div class="sub">${state.fines.filter(f=>!f.paid).length} por regularizar</div></div>
    </div>
    <div style="height:16px"></div>
    <div class="grid two">
      <div class="card soft">
        <div class="card-head"><div><h3>Próximos compromissos</h3><p>O que vem a seguir</p></div><button class="btn secondary sm" data-go="calendar">Ver calendário</button></div>
        <div class="grid two">
          ${nextTraining?`<div><span class="badge green">TREINO</span><h2 style="margin:12px 0 4px">${fmtShort(nextTraining.date)} · ${esc(nextTraining.time||'—')}</h2><div class="muted">${esc(nextTraining.location||'Local por definir')}</div></div>`:`<div>${empty('Sem treino agendado','Cria um treino para começar.')}</div>`}
          ${nextGame?`<div><span class="badge blue">JOGO</span><h2 style="margin:12px 0 4px">${fmtShort(nextGame.date)} · ${esc(nextGame.time||'—')}</h2><div><strong>${nextGame.homeAway==='Casa'?'ADC Figueiras':'@ '+esc(nextGame.opponent)}</strong> ${nextGame.homeAway==='Casa'?`vs ${esc(nextGame.opponent)}`:''}</div><div class="muted">${esc(nextGame.competition||'')}</div></div>`:`<div>${empty('Sem jogo agendado','Adiciona o próximo jogo.')}</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Marcadores</h3><p>Estatísticas introduzidas nos jogos</p></div></div>
        ${scorers.some(x=>x.goals||x.assists)?`<div class="list">${scorers.map((x,i)=>`<div class="list-row"><div style="display:flex;align-items:center;gap:10px"><b>${i+1}</b>${playerHtml(x.p,true)}</div><div><strong>${x.goals}</strong> <span class="muted">G</span> · <strong>${x.assists}</strong> <span class="muted">A</span></div></div>`).join('')}</div>`:empty('Ainda sem estatísticas','Regista golos e assistências nos jogos.')}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Atividade recente</h3><p>Últimos registos</p></div></div>
        ${recent.length?`<div class="list">${recent.map(r=>`<div class="list-row"><div><div><span class="event-dot ${r.type==='game'?'game':r.type==='fine'?'fine':''}"></span><strong>${esc(r.title)}</strong></div><div class="meta">${fmtDate(r.date)}${r.time?' · '+esc(r.time):''} · ${esc(r.sub)}</div></div></div>`).join('')}</div>`:empty('Ainda sem atividade','Os novos registos aparecem aqui.')}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Disponibilidade</h3><p>Estado atual do plantel</p></div></div>
        <div class="list">${['Disponível','Lesionado','Castigado','Indisponível'].map(s=>`<div class="list-row"><div>${statusBadge(s)}</div><strong>${state.players.filter(p=>p.status===s).length}</strong></div>`).join('')}</div>
      </div>
    </div>`;
  $$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
}

function renderSquad(filter=''){
  const q=filter.toLowerCase(); const players=state.players.filter(p=>p.name.toLowerCase().includes(q)||p.position.toLowerCase().includes(q));
  const stats=playerStats();
  $('#view-squad').innerHTML=`
    <div class="section-head"><div><h2>${state.players.length} jogadores</h2><p>Ficha, disponibilidade e números da época.</p></div><button class="btn" id="addPlayer">＋ Adicionar jogador</button></div>
    <div class="toolbar"><div class="search"><input id="playerSearch" placeholder="Pesquisar jogador..." value="${esc(filter)}"></div></div>
    ${players.length?`<div class="table-wrap"><table><thead><tr><th>Jogador</th><th>Estado</th><th>Jogos</th><th>Golos</th><th>Assist.</th><th></th></tr></thead><tbody>${players.map(p=>`<tr><td>${playerHtml(p)}</td><td>${statusBadge(p.status)}</td><td>${stats[p.id]?.games||0}</td><td>${stats[p.id]?.goals||0}</td><td>${stats[p.id]?.assists||0}</td><td><div class="inline-actions"><button class="btn secondary sm edit-player" data-id="${p.id}">Editar</button><button class="btn danger sm delete-player" data-id="${p.id}">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum jogador encontrado')}`;
  $('#addPlayer').onclick=()=>openPlayerModal();
  $('#playerSearch').oninput=e=>renderSquad(e.target.value);
  $$('.edit-player').forEach(b=>b.onclick=()=>openPlayerModal(b.dataset.id));
  $$('.delete-player').forEach(b=>b.onclick=()=>deletePlayer(b.dataset.id));
}
function openPlayerModal(id){
  const p=id?playerById(id):{name:'',position:'Jogador',number:'',status:'Disponível',birth:'',phone:'',notes:''};
  openModal(id?'Editar jogador':'Novo jogador', id?'Atualiza a ficha individual.':'Adicionar ao plantel.', `
    <form id="playerForm"><div class="form-grid">
      <div class="field full"><label>Nome *</label><input name="name" required value="${esc(p.name)}"></div>
      <div class="field"><label>Posição</label><select name="position">${['GR','Fixo','Ala','Pivot','Universal','Jogador'].map(x=>`<option ${p.position===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Número</label><input name="number" inputmode="numeric" value="${esc(p.number)}"></div>
      <div class="field"><label>Estado</label><select name="status">${['Disponível','Lesionado','Castigado','Indisponível'].map(x=>`<option ${p.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Data de nascimento</label><input type="date" name="birth" value="${esc(p.birth)}"></div>
      <div class="field"><label>Contacto</label><input name="phone" value="${esc(p.phone)}"></div>
      <div class="field full"><label>Notas</label><textarea name="notes">${esc(p.notes)}</textarea></div>
    </div><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button class="btn">Guardar</button></div></form>`);
  $('#playerForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)); if(id) Object.assign(p,d); else state.players.push({id:uid('p'),...d}); closeModal(); saveState('Jogador guardado.');};
  $('[data-close]').onclick=closeModal;
}
function deletePlayer(id){
  const p=playerById(id); if(!p) return;
  if(!confirm(`Eliminar ${p.name}? Os registos históricos associados deixam de aparecer corretamente.`)) return;
  state.players=state.players.filter(x=>x.id!==id); saveState('Jogador eliminado.');
}

function renderTrainings(){
  const rows=[...state.trainings].sort((a,b)=>dateTimeOf(b.date,b.time)-dateTimeOf(a.date,a.time));
  $('#view-training').innerHTML=`
    <div class="section-head"><div><h2>Treinos</h2><p>Regista presença, peso antes e depois de cada sessão.</p></div><button class="btn" id="addTraining">＋ Novo treino</button></div>
    ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Hora</th><th>Local</th><th>Presentes</th><th>Pesagens</th><th></th></tr></thead><tbody>${rows.map(t=>{
      const entries=Object.values(t.entries||{}); const present=entries.filter(e=>e.status==='Presente'||e.status==='Atrasado').length; const weights=entries.filter(e=>e.pre||e.post).length;
      return `<tr><td><strong>${fmtDate(t.date)}</strong></td><td>${esc(t.time||'—')}</td><td>${esc(t.location||'—')}</td><td>${present}/${state.players.length}</td><td>${weights}</td><td><div class="inline-actions"><button class="btn secondary sm manage-training" data-id="${t.id}">Abrir</button><button class="btn danger sm delete-training" data-id="${t.id}">Eliminar</button></div></td></tr>`}).join('')}</tbody></table></div>`:empty('Ainda não existem treinos','Cria a primeira sessão e regista as presenças.')}`;
  $('#addTraining').onclick=openTrainingCreate;
  $$('.manage-training').forEach(b=>b.onclick=()=>openTrainingManage(b.dataset.id));
  $$('.delete-training').forEach(b=>b.onclick=()=>{if(confirm('Eliminar este treino?')){state.trainings=state.trainings.filter(t=>t.id!==b.dataset.id);saveState('Treino eliminado.')}});
}
function openTrainingCreate(){
  openModal('Novo treino','Cria a sessão. Depois podes preencher presenças e pesagens.',`
    <form id="trainingForm"><div class="form-grid">
      <div class="field"><label>Data *</label><input type="date" name="date" value="${nowKey()}" required></div>
      <div class="field"><label>Hora</label><input type="time" name="time" value="21:30"></div>
      <div class="field full"><label>Local</label><input name="location" placeholder="Pavilhão / local"></div>
      <div class="field full"><label>Notas</label><textarea name="notes" placeholder="Objetivos, observações..."></textarea></div>
    </div><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button class="btn">Criar treino</button></div></form>`);
  $('#trainingForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const t={id:uid('t'),...d,entries:{}};state.trainings.push(t);closeModal();saveState();openTrainingManage(t.id);};
  $('[data-close]').onclick=closeModal;
}
function openTrainingManage(id){
  const t=state.trainings.find(x=>x.id===id); if(!t)return;
  const rows=state.players.map(p=>{const e=t.entries?.[p.id]||{}; const pre=Number(e.pre),post=Number(e.post); const delta=(e.pre&&e.post)?post-pre:null; const pct=(e.pre&&e.post)?((post-pre)/pre*100):null;
    return `<div class="training-row" data-player="${p.id}">${playerHtml(p,true)}<select class="att-status"><option value="">— Estado —</option>${['Presente','Atrasado','Falta','Justificado','Lesionado'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}</select><input class="w-pre" type="number" step="0.1" min="0" placeholder="Antes kg" value="${esc(e.pre||'')}"><input class="w-post" type="number" step="0.1" min="0" placeholder="Depois kg" value="${esc(e.post||'')}"><div class="delta">${delta===null?'—':`${delta>0?'+':''}${delta.toFixed(1)} kg<br><span class="muted">${pct.toFixed(2)}%</span>`}</div></div>`;
  }).join('');
  openModal(`Treino · ${fmtDate(t.date)}`,`${t.time||''}${t.location?' · '+t.location:''}`,`
    <div class="card" style="padding:14px;margin-bottom:14px"><div class="form-grid"><div class="field"><label>Data</label><input id="editTDate" type="date" value="${esc(t.date)}"></div><div class="field"><label>Hora</label><input id="editTTime" type="time" value="${esc(t.time||'')}"></div><div class="field full"><label>Local</label><input id="editTLocation" value="${esc(t.location||'')}"></div></div></div>
    <div class="toolbar"><button class="btn secondary sm" id="markAllPresent">Marcar todos presentes</button><span class="muted">Peso em kg. A variação é calculada automaticamente.</span></div>
    <div class="training-roster">${rows||empty('Plantel vazio')}</div>
    <div class="form-actions"><button class="btn secondary" data-close>Fechar</button><button class="btn" id="saveTraining">Guardar registos</button></div>`,true);
  $('#markAllPresent').onclick=()=>$$('.att-status',$('#modalBody')).forEach(s=>s.value='Presente');
  $('#saveTraining').onclick=()=>{
    t.date=$('#editTDate').value;t.time=$('#editTTime').value;t.location=$('#editTLocation').value;t.entries=t.entries||{};
    $$('.training-row',$('#modalBody')).forEach(r=>{const id=r.dataset.player; t.entries[id]={status:$('.att-status',r).value,pre:$('.w-pre',r).value,post:$('.w-post',r).value};});
    closeModal();saveState('Treino atualizado.');
  };
  $('[data-close]').onclick=closeModal;
}

function renderGames(){
  const rows=[...state.games].sort((a,b)=>dateTimeOf(b.date,b.time)-dateTimeOf(a.date,a.time));
  $('#view-games').innerHTML=`
    <div class="section-head"><div><h2>Jogos</h2><p>Convocatórias, resultado e estatísticas individuais.</p></div><button class="btn" id="addGame">＋ Novo jogo</button></div>
    ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Jogo</th><th>Competição</th><th>Resultado</th><th>Convocados</th><th></th></tr></thead><tbody>${rows.map(g=>{
      const c=Object.values(g.roster||{}).filter(r=>r.status==='Convocado').length; const score=(g.homeScore!==''&&g.awayScore!=='')?`${esc(g.homeScore)}–${esc(g.awayScore)}`:'—';
      return `<tr><td>${fmtDate(g.date)}<div class="meta">${esc(g.time||'')}</div></td><td><strong>${g.homeAway==='Casa'?'ADC Figueiras':'@ '+esc(g.opponent)}</strong>${g.homeAway==='Casa'?` vs ${esc(g.opponent)}`:''}<div class="meta">${esc(g.venue||'')}</div></td><td>${esc(g.competition||'—')}</td><td class="score">${score}</td><td>${c}</td><td><div class="inline-actions"><button class="btn secondary sm manage-game" data-id="${g.id}">Abrir</button><button class="btn danger sm delete-game" data-id="${g.id}">Eliminar</button></div></td></tr>`}).join('')}</tbody></table></div>`:empty('Ainda não existem jogos','Adiciona o próximo jogo e prepara a convocatória.')}`;
  $('#addGame').onclick=openGameCreate;
  $$('.manage-game').forEach(b=>b.onclick=()=>openGameManage(b.dataset.id));
  $$('.delete-game').forEach(b=>b.onclick=()=>{if(confirm('Eliminar este jogo?')){state.games=state.games.filter(g=>g.id!==b.dataset.id);saveState('Jogo eliminado.')}});
}
function openGameCreate(){
  openModal('Novo jogo','Adiciona o compromisso ao calendário.',`
    <form id="gameForm"><div class="form-grid">
      <div class="field"><label>Data *</label><input type="date" name="date" value="${nowKey()}" required></div><div class="field"><label>Hora</label><input type="time" name="time" value="21:00"></div>
      <div class="field full"><label>Adversário *</label><input name="opponent" required></div>
      <div class="field"><label>Casa / Fora</label><select name="homeAway"><option>Casa</option><option>Fora</option></select></div>
      <div class="field"><label>Competição</label><input name="competition" placeholder="Campeonato / Taça / Amigável"></div>
      <div class="field full"><label>Pavilhão / local</label><input name="venue"></div>
    </div><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button class="btn">Criar jogo</button></div></form>`);
  $('#gameForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target)); const roster={};state.players.forEach(p=>roster[p.id]={status:'Não convocado',stats:{goals:0,assists:0,yellow:0,red:0}});const g={id:uid('g'),...d,homeScore:'',awayScore:'',roster};state.games.push(g);closeModal();saveState();openGameManage(g.id);};
  $('[data-close]').onclick=closeModal;
}
function openGameManage(id){
  const g=state.games.find(x=>x.id===id); if(!g)return;
  g.roster=g.roster||{};
  const cards=state.players.map(p=>{const r=g.roster[p.id]||{status:'Não convocado',stats:{}}; const s=r.stats||{};return `<div class="game-player" data-player="${p.id}"><div class="row">${playerHtml(p,true)}${statusBadge(r.status)}</div><select class="call-status">${['Convocado','Não convocado','Lesionado','Castigado','Indisponível'].map(x=>`<option ${r.status===x?'selected':''}>${x}</option>`).join('')}</select><div class="stat-grid"><label>Golos<input class="st-goals" type="number" min="0" value="${Number(s.goals)||0}"></label><label>Assist.<input class="st-assists" type="number" min="0" value="${Number(s.assists)||0}"></label><label>Amarelos<input class="st-yellow" type="number" min="0" value="${Number(s.yellow)||0}"></label><label>Vermelhos<input class="st-red" type="number" min="0" value="${Number(s.red)||0}"></label></div></div>`}).join('');
  openModal(`${g.homeAway==='Casa'?'ADC Figueiras vs':'ADC Figueiras @'} ${g.opponent}`,`${fmtDate(g.date)} · ${g.time||'—'} · ${g.competition||'Jogo'}`,`
    <div class="card" style="padding:14px;margin-bottom:14px"><div class="form-grid">
      <div class="field"><label>Data</label><input id="editGDate" type="date" value="${esc(g.date)}"></div><div class="field"><label>Hora</label><input id="editGTime" type="time" value="${esc(g.time||'')}"></div>
      <div class="field"><label>Golos Figueiras</label><input id="homeScore" type="number" min="0" value="${esc(g.homeScore)}"></div><div class="field"><label>Golos adversário</label><input id="awayScore" type="number" min="0" value="${esc(g.awayScore)}"></div>
      <div class="field full"><label>Local</label><input id="editGVenue" value="${esc(g.venue||'')}"></div>
    </div></div>
    <div class="card-head"><div><h3>Convocatória e estatísticas</h3><p>As estatísticas alimentam automaticamente o resumo do plantel.</p></div><button class="btn secondary sm" id="convocateAll">Convocar todos</button></div>
    <div class="game-roster">${cards||empty('Plantel vazio')}</div>
    <div class="form-actions"><button class="btn secondary" data-close>Fechar</button><button class="btn" id="saveGame">Guardar jogo</button></div>`,true);
  $('#convocateAll').onclick=()=>$$('.call-status',$('#modalBody')).forEach(s=>s.value='Convocado');
  $('#saveGame').onclick=()=>{
    g.date=$('#editGDate').value;g.time=$('#editGTime').value;g.homeScore=$('#homeScore').value;g.awayScore=$('#awayScore').value;g.venue=$('#editGVenue').value;
    $$('.game-player',$('#modalBody')).forEach(r=>{const pid=r.dataset.player;g.roster[pid]={status:$('.call-status',r).value,stats:{goals:Number($('.st-goals',r).value)||0,assists:Number($('.st-assists',r).value)||0,yellow:Number($('.st-yellow',r).value)||0,red:Number($('.st-red',r).value)||0}};});
    closeModal();saveState('Jogo atualizado.');
  };
  $('[data-close]').onclick=closeModal;
}

function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(); const first=new Date(y,m,1); const start=(first.getDay()+6)%7; const days=new Date(y,m+1,0).getDate(); const prevDays=new Date(y,m,0).getDate();
  const monthLabel=new Intl.DateTimeFormat('pt-PT',{month:'long',year:'numeric'}).format(first);
  let cells='';
  for(let i=0;i<42;i++){
    let d,muted=false,cy=y,cm=m;
    if(i<start){d=prevDays-start+i+1;muted=true;cm=m-1;if(cm<0){cm=11;cy--}}
    else if(i>=start+days){d=i-(start+days)+1;muted=true;cm=m+1;if(cm>11){cm=0;cy++}}
    else d=i-start+1;
    const key=`${cy}-${pad(cm+1)}-${pad(d)}`; const events=[...state.trainings.filter(t=>t.date===key).map(t=>({type:'training',label:`Treino ${t.time||''}`,id:t.id})),...state.games.filter(g=>g.date===key).map(g=>({type:'game',label:`${g.homeAway==='Casa'?'vs':'@'} ${g.opponent}`,id:g.id}))];
    cells+=`<div class="calendar-day ${muted?'muted':''} ${key===nowKey()?'today':''}"><div class="day-num">${d}</div>${events.slice(0,3).map(e=>`<button class="cal-event ${e.type==='game'?'game':''}" data-type="${e.type}" data-id="${e.id}" style="border:0;width:100%;text-align:left;cursor:pointer">${esc(e.label)}</button>`).join('')}${events.length>3?`<div class="meta">+${events.length-3}</div>`:''}</div>`;
  }
  $('#view-calendar').innerHTML=`<div class="calendar-head"><button class="btn secondary sm" id="calPrev">←</button><h2 style="text-transform:capitalize">${esc(monthLabel)}</h2><button class="btn secondary sm" id="calNext">→</button></div><div class="calendar-grid">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=>`<div class="dow">${x}</div>`).join('')}${cells}</div>`;
  $('#calPrev').onclick=()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar()}; $('#calNext').onclick=()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar()};
  $$('.cal-event').forEach(b=>b.onclick=()=>b.dataset.type==='game'?openGameManage(b.dataset.id):openTrainingManage(b.dataset.id));
}

function renderFines(){
  const pending=state.fines.filter(f=>!f.paid).reduce((s,f)=>s+Number(f.amount||0),0), paid=state.fines.filter(f=>f.paid).reduce((s,f)=>s+Number(f.amount||0),0);
  const rows=[...state.fines].sort((a,b)=>dateTimeOf(b.date)-dateTimeOf(a.date));
  $('#view-fines').innerHTML=`
    <div class="grid three" style="margin-bottom:16px"><div class="card kpi"><div class="label">Por pagar</div><div class="value">${money(pending)}</div><div class="sub">${state.fines.filter(f=>!f.paid).length} multas</div></div><div class="card kpi"><div class="label">Pago</div><div class="value accent">${money(paid)}</div><div class="sub">Total regularizado</div></div><div class="card kpi"><div class="label">Caixa total</div><div class="value">${money(pending+paid)}</div><div class="sub">Multas registadas</div></div></div>
    <div class="section-head"><div><h2>Registos</h2><p>Motivo, valor e estado de pagamento.</p></div><button class="btn" id="addFine">＋ Nova multa</button></div>
    ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Jogador</th><th>Motivo</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(f=>`<tr><td>${fmtDate(f.date)}</td><td>${esc(playerById(f.playerId)?.name||'Jogador removido')}</td><td>${esc(f.reason)}</td><td><strong>${money(f.amount)}</strong></td><td>${f.paid?'<span class="badge green">Pago</span>':'<span class="badge amber">Pendente</span>'}</td><td><div class="inline-actions"><button class="btn secondary sm toggle-fine" data-id="${f.id}">${f.paid?'Marcar pendente':'Marcar pago'}</button><button class="btn danger sm delete-fine" data-id="${f.id}">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>`:empty('Sem multas registadas','Esperemos que fique assim.')}`;
  $('#addFine').onclick=openFineModal;
  $$('.toggle-fine').forEach(b=>b.onclick=()=>{const f=state.fines.find(x=>x.id===b.dataset.id);f.paid=!f.paid;saveState('Estado atualizado.');});
  $$('.delete-fine').forEach(b=>b.onclick=()=>{if(confirm('Eliminar esta multa?')){state.fines=state.fines.filter(x=>x.id!==b.dataset.id);saveState('Multa eliminada.')}});
}
function openFineModal(){
  openModal('Nova multa','Regista o valor e o motivo.',`
    <form id="fineForm"><div class="form-grid"><div class="field full"><label>Jogador *</label><select name="playerId" required><option value="">Selecionar...</option>${state.players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Data *</label><input type="date" name="date" value="${nowKey()}" required></div><div class="field"><label>Valor (€) *</label><input type="number" name="amount" step="0.50" min="0" required></div><div class="field full"><label>Motivo *</label><input name="reason" placeholder="Atraso, falta injustificada..." required></div><div class="field full"><label><input type="checkbox" name="paid" style="width:auto"> Já está paga</label></div></div><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button class="btn">Guardar multa</button></div></form>`);
  $('#fineForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);state.fines.push({id:uid('f'),playerId:fd.get('playerId'),date:fd.get('date'),amount:Number(fd.get('amount')),reason:fd.get('reason'),paid:fd.get('paid')==='on'});closeModal();saveState('Multa registada.');}; $('[data-close]').onclick=closeModal;
}

function renderSettings(){
  $('#view-settings').innerHTML=`<div class="grid two">
    <div class="card settings-card"><div class="card-head"><div><h3>Época e clube</h3><p>Informação geral da aplicação</p></div></div><div class="field"><label>Nome do clube</label><input id="clubName" value="${esc(state.settings.club)}"></div><div class="field"><label>Época</label><input id="seasonInput" value="${esc(state.settings.season)}"></div><div><button class="btn" id="saveSettings">Guardar alterações</button></div></div>
    <div class="card settings-card"><div class="card-head"><div><h3>Backup</h3><p>Leva os dados contigo ou restaura noutro dispositivo</p></div></div><p class="note">A V1 guarda tudo neste browser. Exporta regularmente um ficheiro JSON como cópia de segurança.</p><div class="toolbar"><button class="btn" id="exportData">Exportar dados</button><button class="btn secondary" id="importData">Importar backup</button></div></div>
    <div class="card settings-card"><div class="card-head"><div><h3>Resumo da base de dados</h3><p>O que está guardado neste dispositivo</p></div></div><div class="list"><div class="list-row"><span>Jogadores</span><strong>${state.players.length}</strong></div><div class="list-row"><span>Treinos</span><strong>${state.trainings.length}</strong></div><div class="list-row"><span>Jogos</span><strong>${state.games.length}</strong></div><div class="list-row"><span>Multas</span><strong>${state.fines.length}</strong></div></div></div>
    <div class="card settings-card danger-zone"><div class="card-head"><div><h3>Repor aplicação</h3><p>Apaga treinos, jogos e multas</p></div></div><p class="note">Repõe a V1 e volta a carregar o plantel inicial. Exporta primeiro um backup se quiseres conservar estes dados.</p><div><button class="btn danger" id="resetData">Repor dados</button></div></div>
  </div>`;
  $('#saveSettings').onclick=()=>{state.settings.club=$('#clubName').value.trim()||'ADC Figueiras';state.settings.season=$('#seasonInput').value.trim()||'2026/27';saveState('Definições guardadas.');};
  $('#exportData').onclick=exportData; $('#importData').onclick=()=>$('#importInput').click();
  $('#resetData').onclick=()=>{if(confirm('Tens a certeza? Todos os registos desta aplicação serão apagados.')){state=defaultState();saveState('Aplicação reposta.')}};
}
function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ADC-Figueiras_${state.settings.season.replace('/','-')}_backup_${nowKey()}.json`;a.click();URL.revokeObjectURL(a.href);toast('Backup exportado.');
}
function importData(file){
  const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data.players||!Array.isArray(data.players))throw new Error('Formato inválido');state={...defaultState(),...data,settings:{...defaultState().settings,...(data.settings||{})}};saveState('Backup importado.');}catch(e){alert('Não foi possível importar este ficheiro. Verifica se é um backup válido da aplicação.')}};reader.readAsText(file);
}

function openModal(title,subtitle,body,wide=false){ $('#modalTitle').textContent=title;$('#modalSubtitle').textContent=subtitle||'';$('#modalBody').innerHTML=body;$('#modal').classList.toggle('wide',!!wide);$('#modalBackdrop').classList.remove('hidden');document.body.style.overflow='hidden'; }
function closeModal(){ $('#modalBackdrop').classList.add('hidden');$('#modal').classList.remove('wide');document.body.style.overflow=''; }

function quickAdd(){
  if(currentView==='squad') return openPlayerModal(); if(currentView==='training') return openTrainingCreate(); if(currentView==='games') return openGameCreate(); if(currentView==='fines') return openFineModal();
  openModal('Adicionar','Escolhe o tipo de registo.',`<div class="grid two"><button class="btn" id="qaTraining">Novo treino</button><button class="btn" id="qaGame">Novo jogo</button><button class="btn secondary" id="qaPlayer">Novo jogador</button><button class="btn secondary" id="qaFine">Nova multa</button></div>`);
  $('#qaTraining').onclick=()=>{closeModal();openTrainingCreate()};$('#qaGame').onclick=()=>{closeModal();openGameCreate()};$('#qaPlayer').onclick=()=>{closeModal();openPlayerModal()};$('#qaFine').onclick=()=>{closeModal();openFineModal()};
}

$$('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
$('#quickAdd').onclick=quickAdd; $('#closeModal').onclick=closeModal;
$('#modalBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('#importInput').addEventListener('change',e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value='';});

const today = new Intl.DateTimeFormat('pt-PT',{weekday:'short',day:'2-digit',month:'short'}).format(new Date()); $('#todayChip').textContent=today;
if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();
