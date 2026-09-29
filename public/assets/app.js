'use strict';
// All mutations go through the authenticated PHP API. No business data in localStorage.
const root = document.querySelector('#app'),
  dialog = document.querySelector('#dialog');
let state = {},
  detail = null,
  currentTab = 'board',
  filter = 'all',
  renderNumber = 0,
  modalSubmit = null,
  toastTimer;
const labels = {
  admin: 'Amministratore',
  member: 'Team',
  client: 'Cliente',
  todo: 'Da fare',
  doing: 'In corso',
  review: 'In revisione',
  done: 'Approvata',
  active: 'In corso',
  completed: 'Completata',
  archived: 'Archiviata',
  new: 'Da leggere',
  accepted: 'Accolta',
  declined: 'Non accolta',
  approved: 'Approvata',
  changes: 'Modifiche richieste',
  low: 'Bassa',
  normal: 'Normale',
  high: 'Alta',
};
const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  folder: 'M3 7V4h6l3 3h9v13H3z',
  inbox: 'M4 4h16l2 12h-6l-2 3h-4l-2-3H2z M2 16v5h20v-5',
  users:
    'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',
  chart: 'M4 20V10 M12 20V4 M20 20v-7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
  check: 'M5 12l4 4L20 5',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.grid}"/></svg>`;
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const initials = (name) =>
  esc(
    String(name || 'P')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join(''),
  );
const date = (value) =>
  value
    ? new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
      })
    : 'Senza scadenza';
const timestamp = (value) =>
  value
    ? new Date(value.replace(' ', 'T') + 'Z').toLocaleString('it-IT', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
const hours = (value) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(Number(value) / 60);
const today = () => new Date().toLocaleDateString('en-CA');
const isAdmin = () => state.user?.role === 'admin',
  isClient = () => state.user?.role === 'client';
const badge = (status) =>
  `<span class="pill ${['review', 'new', 'changes', 'high'].includes(status) ? 'warm' : ['doing', 'accepted'].includes(status) ? 'blue' : ['archived', 'declined', 'low'].includes(status) ? 'gray' : ''}">${esc(labels[status] || status)}</span>`;
const button = (text, action, id = '', style = '') =>
  `<button class="btn ${style}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;
const empty = (title, body) => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
const field = (label, name, type = 'text', value = '', extra = '') =>
  `<label class="field ${type === 'textarea' ? 'full' : ''}">${esc(label)}${type === 'textarea' ? `<textarea name="${name}" maxlength="4000" ${extra}>${esc(value)}</textarea>` : `<input type="${type}" name="${name}" value="${esc(value)}" ${extra}>`}</label>`;
const select = (label, name, items, value = '', extra = '') =>
  `<label class="field">${esc(label)}<select name="${name}" ${extra}>${items.map(([id, title]) => `<option value="${esc(id)}" ${String(id) === String(value) ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;
const priority = (value = 'normal') =>
  select(
    'Priorità',
    'priority',
    [
      ['low', 'Bassa'],
      ['normal', 'Normale'],
      ['high', 'Alta'],
    ],
    value,
  );
const clientOptions = () => state.clients.map((c) => [c.id, `${c.company || c.name} · ${c.name}`]);
const staffOptions = () =>
  state.people.filter((p) => p.role !== 'client').map((p) => [p.id, p.name]);
function toast(text) {
  const el = document.querySelector('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}
async function api(action, data, query = {}) {
  const url = 'api.php?' + new URLSearchParams({ action, ...query }),
    options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (data !== undefined) {
    options.method = 'POST';
    options.headers['X-CSRF-Token'] = state.csrf || '';
    if (data instanceof FormData) options.body = data;
    else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
  }
  const response = await fetch(url, options);
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error('Risposta non leggibile. Verifica che il server PHP sia attivo.');
  }
  if (!response.ok) {
    const error = Error(result.error || 'Operazione non completata.');
    error.status = response.status;
    throw error;
  }
  if (result.csrf) state.csrf = result.csrf;
  return result;
}
async function refresh() {
  state = await api('state');
  await render();
}
function route() {
  return location.hash.slice(1).split('/');
}
function goto(path) {
  if (location.hash === '#' + path) render();
  else location.hash = path;
}
function layout(title, body) {
  const current = route()[0] || 'overview',
    nav = [
      ['overview', 'grid', 'Panoramica'],
      ['projects', 'folder', 'Commesse'],
      ...(!isClient() && !isAdmin() ? [] : [['requests', 'inbox', 'Richieste']]),
      ...(!isClient()
        ? [
            ['clients', 'users', 'Clienti'],
            ['reports', 'chart', 'Report'],
          ]
        : []),
      ...(isAdmin() ? [['team', 'users', 'Persone e accessi']] : []),
    ];
  return `<div class="shell"><aside class="sidebar"><button class="mobile-close icon-btn" data-action="menu" aria-label="Chiudi il menu">×</button><a class="brand" href="./" aria-label="Punto, presentazione">punto<i></i></a><p class="side-label">IL TUO WORKSPACE</p><nav class="side-nav" aria-label="Menu del gestionale">${nav.map(([link, i, label]) => `<a href="#${link}" class="${current === link || (current === 'project' && link === 'projects') ? 'active' : ''}" ${current === link ? 'aria-current="page"' : ''}>${icon(i)}${label}${link === 'requests' && state.requests.filter((r) => r.status === 'new').length ? `<span class="nav-count">${state.requests.filter((r) => r.status === 'new').length}</span>` : ''}</a>`).join('')}</nav><div class="side-message"><span>↗</span><p>Un passo alla volta.<br>Nella stessa direzione.</p><small>${state.demo ? 'Ambiente demo locale.<br>Le modifiche vengono salvate.' : 'Il tuo lavoro, nel posto giusto.'}</small></div><div class="side-user"><span class="avatar">${initials(state.user.name)}</span><div><strong>${esc(state.user.name)}</strong><small>${labels[state.user.role]}</small></div><button data-action="profile" aria-label="Impostazioni account" title="Il tuo account">⋯</button></div></aside><div class="workspace"><header class="topbar"><button class="mobile-toggle" data-action="menu" aria-expanded="false" aria-label="Apri il menu">${icon('menu')}</button><div class="crumb"><span>Workspace</span><span>/</span><strong>${esc(title)}</strong></div><div class="top-actions"><form class="search" id="search-form">${icon('search')}<input name="q" aria-label="Cerca commesse e attività" placeholder="Cerca nel workspace" maxlength="100" required></form>${state.demo ? `<select class="demo-select" id="demo-role" aria-label="Cambia ruolo demo">${['admin', 'member', 'client'].map((r) => `<option value="${r}" ${state.user.role === r ? 'selected' : ''}>Demo · ${labels[r]}</option>`).join('')}</select>` : ''}<span class="avatar">${initials(state.user.name)}</span></div></header><main class="content" id="main" tabindex="-1">${body}<footer class="workspace-footer"><span>Punto · Progettato da Flavio Petrone</span><span>${state.demo ? 'Dati dimostrativi · Nessun cliente reale' : 'Un filo continuo, dall’idea alla consegna.'}</span></footer></main></div></div>`;
}
function title(eyebrow, heading, description, action = '') {
  return `<div class="page-title"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(heading)}</h1><p>${esc(description)}</p></div>${action}</div>`;
}
function metric(label, value, caption, i) {
  return `<div class="metric"><span>${label}</span>${icon(i)}<strong>${value}</strong><small>${caption}</small></div>`;
}
function projectCard(p) {
  const r = state.report.find((x) => x.id === p.id) || { tasks: 0, done: 0 };
  const progress = r.tasks ? Math.round((r.done / r.tasks) * 100) : 0;
  return `<a href="#project/${p.id}" class="project-card"><div class="project-visual ${p.color}"><small>${esc(p.code)}</small><i class="project-symbol"></i><span>↗</span></div><div class="project-body"><small>${esc(p.client_name)}</small><h3>${esc(p.title)}</h3><div class="progress-line"><i style="width:${progress}%"></i></div><div class="project-progress"><span>${r.done} di ${r.tasks} attività approvate</span><span>${progress}%</span></div><div class="project-footer">${badge(p.status)}<span>${date(p.due_date)}</span></div></div></a>`;
}
function taskRow(t) {
  return `<button class="task-row" data-action="task" data-id="${t.id}"><span class="task-dot ${t.status}"></span><div><strong>${esc(t.title)}</strong><small>${esc(t.project_title || '')} · ${date(t.due_date)}</small></div>${badge(t.status)}</button>`;
}
function overview() {
  const active = state.projects.filter((p) => p.status === 'active'),
    pending = state.tasks.filter((t) => t.status === 'review'),
    open = state.requests.filter((r) => r.status === 'new'),
    minutes = state.report.reduce((a, r) => a + r.minutes, 0);
  return (
    title(
      'IL TUO PUNTO DI PARTENZA',
      `Ciao, ${state.user.name.split(' ')[0]}.`,
      isClient()
        ? 'I tuoi progetti, le prossime decisioni. Tutto qui.'
        : 'Facciamo spazio al lavoro che conta.',
      isAdmin()
        ? button('Nuova commessa <span>＋</span>', 'new-project')
        : `<span class="date-note">${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`,
    ) +
    `<div class="metrics">${metric('Commesse attive', active.length, 'Idee che stanno prendendo forma', 'folder')}${metric('Attività in corso', state.tasks.filter((t) => t.status === 'doing').length, 'Un passo dopo l’altro', 'grid')}${metric('Da approvare', pending.length, 'Il prossimo sì del cliente', 'check')}${metric(isClient() ? 'Richieste aperte' : 'Ore registrate', isClient() ? open.length : hours(minutes), isClient() ? 'Un nuovo punto di partenza' : 'Su tutte le commesse visibili', 'clock')}</div><div class="section-label"><h2>I progetti in movimento</h2><a href="#projects">Tutte le commesse ↗</a></div>${active.length ? `<div class="project-grid">${active.slice(0, 3).map(projectCard).join('')}</div>` : empty('Si parte da una buona idea.', 'Le nuove commesse appariranno qui.')}<div class="overview-bottom"><section class="panel"><div class="section-label"><h2>${isClient() ? 'Le tue prossime decisioni' : 'Da tenere a fuoco'}</h2><span>${state.tasks.filter((t) => t.status !== 'done').length} attività aperte</span></div>${(isClient() ? pending : state.tasks.filter((t) => t.status !== 'done')).slice(0, 4).map(taskRow).join('') || '<p class="muted">Tutto in ordine, per ora.</p>'}</section><section class="panel"><div class="section-label"><h2>${state.user.role === 'member' ? 'Ultimi aggiornamenti' : 'Le ultime richieste'}</h2>${state.user.role !== 'member' ? '<a href="#requests">Apri ↗</a>' : ''}</div>${
      state.user.role === 'member'
        ? audit(state.events.slice(0, 3))
        : open
            .slice(0, 3)
            .map(
              (r) =>
                `<div class="request-mini"><span class="avatar">${initials(r.client_name)}</span><div><h3>${esc(r.title)}</h3><p>${esc(r.client_name)} · ${date(r.created_at)}</p></div><a href="#requests" aria-label="Apri richiesta ${esc(r.title)}">↗</a></div>`,
            )
            .join('') || '<p class="muted">Non ci sono richieste da leggere.</p>'
    }</section></div>`
  );
}
function projects() {
  const list = state.projects.filter((p) => filter === 'all' || p.status === filter);
  return (
    title(
      'DAL BRIEF ALLA CONSEGNA',
      'Le tue commesse.',
      'Persone, attività e decisioni, collegate allo stesso obiettivo.',
      isAdmin() ? button('Nuova commessa ＋', 'new-project') : '',
    ) +
    `<div class="filters">${['all', 'active', 'completed', 'archived'].map((s) => `<button class="filter ${filter === s ? 'active' : ''}" data-filter="${s}">${s === 'all' ? 'Tutte' : labels[s]}</button>`).join('')}</div>${list.length ? `<div class="project-grid">${list.map(projectCard).join('')}</div>` : empty('Nessuna commessa qui.', 'Le commesse in questo stato compariranno in questa sezione.')}`
  );
}
function requests() {
  return (
    title(
      'PRIMA DI INIZIARE',
      'Le richieste.',
      'Ogni nuova idea ha un punto di partenza.',
      button('Nuova richiesta ＋', 'new-request'),
    ) +
    `<div class="request-list">${state.requests.map((r) => `<article class="request-card"><div><div class="tag-row">${badge(r.status)}${r.priority === 'high' ? badge('high') : ''}</div><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><small>${esc(r.client_name)} · ${date(r.created_at)}</small></div><div class="toolbar">${r.project_id ? `<a class="btn ghost small" href="#project/${r.project_id}">Apri commessa ↗</a>` : isAdmin() && r.status === 'new' ? button('Non accogliere', 'decline-request', r.id, 'ghost small') + button('Crea commessa ↗', 'convert-request', r.id, 'small') : ''}</div></article>`).join('') || empty('Spazio alle nuove idee.', 'Invia una richiesta per condividere un nuovo obiettivo con lo studio.')}</div>`
  );
}
function clients() {
  return (
    title(
      'LE RELAZIONI CONTANO',
      'I clienti.',
      'Una rubrica collegata al lavoro, non un altro elenco da aggiornare.',
      isAdmin() ? button('Nuovo cliente ＋', 'new-client') : '',
    ) +
    (state.clients.length
      ? `<div class="table-wrap"><table><thead><tr><th>Persona / Attività</th><th>Email</th><th>Commesse</th><th>In corso</th></tr></thead><tbody>${state.clients.map((c) => `<tr><td><strong>${esc(c.company || c.name)}</strong><small>${esc(c.name)}</small></td><td>${esc(c.email)}</td><td>${state.projects.filter((p) => p.client_id === c.id).length}</td><td>${state.projects.filter((p) => p.client_id === c.id && p.status === 'active').length}</td></tr>`).join('')}</tbody></table></div>`
      : empty(
          'Il primo cliente, il primo progetto.',
          'Crea una scheda cliente prima di aprire una commessa.',
        ))
  );
}
function people() {
  return (
    title(
      'A CIASCUNO IL SUO SPAZIO',
      'Persone e accessi.',
      'Aggiungi il team e crea un accesso riservato per ogni cliente.',
      button('Crea accesso ＋', 'new-user'),
    ) +
    `<div class="table-wrap"><table><thead><tr><th>Persona</th><th>Email</th><th>Ruolo</th><th>Cliente collegato</th></tr></thead><tbody>${state.people.map((u) => `<tr><td><strong>${esc(u.name)}</strong><small>${u.active ? 'Accesso attivo' : 'Disattivato'}</small></td><td>${esc(u.email)}</td><td>${labels[u.role]}</td><td>${esc(state.clients.find((c) => c.id === u.client_id)?.company || '—')}</td></tr>`).join('')}</tbody></table></div><p class="password-note" style="margin-top:20px">La creazione dell’accesso non invia email automatiche. Comunica le credenziali alla persona tramite un canale privato.</p>`
  );
}
function reports() {
  const done = state.report.reduce((a, r) => a + r.done, 0),
    total = state.report.reduce((a, r) => a + r.tasks, 0),
    minutes = state.report.reduce((a, r) => a + r.minutes, 0),
    percent = total ? Math.round((done / total) * 100) : 0;
  return (
    title(
      'IL LAVORO, IN NUMERI',
      'Una visione più chiara.',
      'Tempi e avanzamento calcolati dalle attività delle tue commesse.',
      '<a class="btn" href="api.php?action=export">Esporta CSV ↓</a>',
    ) +
    `<div class="report-grid"><section class="panel"><div class="section-label"><h2>Tempo investito</h2><span>${hours(minutes)} ore totali</span></div>${state.report.map((r) => `<div class="bar-row"><div><strong>${esc(r.title)}</strong><span>${hours(r.minutes)} / ${hours(r.budget_minutes)} h</span></div><div class="progress-line"><i style="width:${r.budget_minutes ? Math.min(100, (r.minutes / r.budget_minutes) * 100) : 0}%"></i></div><small>${r.budget_minutes ? (r.minutes > r.budget_minutes ? 'Budget superato di ' + hours(r.minutes - r.budget_minutes) + ' ore' : hours(r.budget_minutes - r.minutes) + ' ore ancora a budget') : 'Budget non impostato'}</small></div>`).join('') || '<p class="muted">I tempi appariranno qui.</p>'}</section><section class="panel"><h2 style="font-size:19px">Attività approvate</h2><div class="report-ring" style="--amount:${percent}%"><div><strong>${percent}%</strong><small>${done} su ${total} attività</small></div></div><p class="report-key">Le approvazioni spettano al cliente.</p></section></div><div class="table-wrap"><table><thead><tr><th>Commessa</th><th>Stato</th><th>Scadenza</th><th>Ore</th><th>Attività approvate</th></tr></thead><tbody>${state.report.map((r) => `<tr><td><a href="#project/${r.id}"><strong>${esc(r.title)}</strong><small>${esc(r.client_name)}</small></a></td><td>${badge(r.status)}</td><td>${date(r.due_date)}</td><td>${hours(r.minutes)}</td><td>${r.done} / ${r.tasks}</td></tr>`).join('')}</tbody></table></div>`
  );
}
function audit(events) {
  return `<div class="audit-list">${events.map((e) => `<div class="audit-row"><span class="avatar">${initials(e.actor)}</span><div><strong>${esc(e.detail)}</strong><small>${esc(e.actor)} · ${timestamp(e.created_at)}</small></div></div>`).join('') || '<p class="muted">Le operazioni compariranno qui.</p>'}</div>`;
}
function projectView() {
  const p = detail.project,
    closed = p.status !== 'active';
  return `<div class="project-heading ${p.color}"><a class="back-link" href="#projects">← Tutte le commesse</a><div class="page-title"><div><span class="eyebrow">${esc(p.code)} / ${esc(p.client_name)}</span><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p></div>${isAdmin() ? button('Impostazioni', 'project-settings', p.id, 'ghost small') : badge(p.status)}</div><div class="project-meta">${badge(p.status)}<span>${icon('clock')} ${date(p.due_date)}</span><span>Budget ${hours(p.budget_minutes)} ore</span><span>${detail.members.map((m) => `<span class="avatar" title="${esc(m.name)}">${initials(m.name)}</span>`).join('')}</span>${isAdmin() && !closed ? `<button class="icon-btn" data-action="member-add" aria-label="Aggiungi persona al team">＋</button>` : ''}</div></div><div class="tabs" role="tablist" aria-label="Sezioni della commessa">${[['board', 'Attività'], ...(!isClient() ? [['time', 'Tempo registrato']] : []), ['deliveries', 'Consegne'], ['audit', 'Storico']].map(([id, name]) => `<button role="tab" id="tab-${id}" aria-controls="project-panel" tabindex="${currentTab === id ? 0 : -1}" aria-selected="${currentTab === id}" class="${currentTab === id ? 'active' : ''}" data-tab="${id}">${name}</button>`).join('')}</div><section id="project-panel" role="tabpanel" aria-labelledby="tab-${currentTab}">${currentTab === 'board' ? board() : currentTab === 'time' ? timeView() : currentTab === 'deliveries' ? deliveries() : `<section class="panel">${audit(detail.events)}</section>`}</section>`;
}
function board() {
  const p = detail.project;
  return `<div class="board-toolbar"><span>${detail.tasks.length} attività · Le approvazioni vengono registrate nello storico.</span>${!isClient() && p.status === 'active' ? button('Nuova attività ＋', 'new-task', '', 'small') : ''}</div><div class="board">${[
    'todo',
    'doing',
    'review',
    'done',
  ]
    .map((status) => {
      const ts = detail.tasks.filter((t) => t.status === status);
      return `<section class="board-col"><div class="col-title"><span>${labels[status]}</span><span>${ts.length}</span></div>${ts.map((t) => `<button class="task-card" data-action="task" data-id="${t.id}">${badge(t.priority)}<h3>${esc(t.title)}</h3><div><span>${date(t.due_date)}</span><span class="avatar" title="${esc(t.assignee_name || 'Non assegnata')}">${initials(t.assignee_name || '—')}</span></div></button>`).join('') || '<div class="column-empty">Nessuna attività<br>in questa fase.</div>'}</section>`;
    })
    .join('')}</div>`;
}
function timeView() {
  return `<div class="board-toolbar"><span>${hours(detail.time.reduce((a, t) => a + Number(t.minutes), 0))} ore registrate · ${detail.time.length} registrazioni</span>${detail.project.status === 'active' ? button('Registra tempo ＋', 'new-time', '', 'small') : ''}</div>${detail.time.length ? `<div class="table-wrap"><table><thead><tr><th>Attività / Nota</th><th>Persona</th><th>Data</th><th>Tempo</th></tr></thead><tbody>${detail.time.map((t) => `<tr><td><strong>${esc(t.task_title || 'Commessa')}</strong><small>${esc(t.note)}</small></td><td>${esc(t.user_name)}</td><td>${date(t.work_date)}</td><td>${hours(t.minutes)} h</td></tr>`).join('')}</tbody></table></div>` : empty('Il tempo merita attenzione.', 'Registra le ore dedicate alla commessa e ritrovale nei report.')}`;
}
function deliveries() {
  return `<div class="board-toolbar"><span>Versioni distinte. File riservati alle persone della commessa.</span>${!isClient() && detail.project.status === 'active' ? button('Carica consegna ↑', 'new-delivery', '', 'small') : ''}</div>${detail.deliverables.length ? `<div class="delivery-grid">${detail.deliverables.map((f) => `<article class="delivery"><div class="delivery-head"><span class="file-icon">${f.mime === 'application/pdf' ? 'PDF' : 'IMG'}</span>${badge(f.status)}</div><span class="eyebrow">VERSIONE ${f.revision} · ${date(f.created_at)}</span><h3 style="margin-top:12px">${esc(f.title)}</h3><p>${esc(f.original_name)} · ${(f.bytes / 1024).toFixed(0)} KB</p>${f.feedback ? `<div class="feedback">${esc(f.feedback)}</div>` : ''}<div class="toolbar"><a class="btn ghost small" href="api.php?action=download&id=${f.id}">Scarica ↓</a>${isClient() && f.status === 'review' && detail.project.status === 'active' ? button('Valuta consegna', 'review-delivery', f.id, 'small') : ''}</div></article>`).join('')}</div>` : empty('La prossima versione parte da qui.', 'Carica un documento o un’anteprima. Il cliente potrà approvare o chiedere modifiche.')}`;
}
function login() {
  root.innerHTML = `<main class="login-page" id="main"><section class="login-art"><a class="brand" href="./">punto<i></i></a><div><h1>Le idee hanno<br>bisogno di<br><em>un posto.</em></h1><p>Dal primo brief alla consegna approvata.<br>Il lavoro riprende da qui.</p></div><small>Progetto indipendente · Flavio Petrone</small><div class="login-orbit"></div></section><section class="login-main"><div class="login-box"><span class="eyebrow">IL TUO WORKSPACE</span><h2>Ci ritroviamo qui.</h2><p>Accedi al tuo spazio di lavoro.</p><form id="login-form" class="stack">${field('Email', 'email', 'email', '', 'required autocomplete="username" maxlength="254"')}${field('Password', 'password', 'password', '', 'required autocomplete="current-password" maxlength="128"')}<p class="form-error" role="alert"></p><button class="btn">Entra in Punto <span>↗</span></button></form>${state.demo ? `<div class="demo-roles"><p>OPPURE ESPLORA LA DEMO LOCALE</p><div class="demo-buttons"><button data-action="demo" data-id="admin"><span>↗</span>Studio</button><button data-action="demo" data-id="member"><span>⌘</span>Team</button><button data-action="demo" data-id="client"><span>✓</span>Cliente</button></div><p style="margin:14px 0 0;line-height:1.6">Persone e commesse sono inventate. I tre profili permettono di provare lo stesso progetto da prospettive diverse.</p></div>` : ''}<div class="login-foot"><a href="./">← Torna alla presentazione</a></div></div></section></main>`;
}
async function render() {
  const n = ++renderNumber;
  if (!state.user) {
    login();
    return;
  }
  const [page = 'overview', id] = route();
  const names = {
    overview: 'Panoramica',
    projects: 'Commesse',
    requests: 'Richieste',
    clients: 'Clienti',
    reports: 'Report',
    team: 'Persone e accessi',
    project: 'Dettaglio commessa',
  };
  try {
    let html;
    if (page === 'project') {
      detail = await api('project', undefined, { id });
      if (n !== renderNumber) return;
      if (isClient() && currentTab === 'time') currentTab = 'board';
      html = projectView();
    } else if (page === 'projects') html = projects();
    else if (page === 'requests' && (isAdmin() || isClient())) html = requests();
    else if (page === 'clients' && !isClient()) html = clients();
    else if (page === 'reports' && !isClient()) html = reports();
    else if (page === 'team' && isAdmin()) html = people();
    else html = overview();
    root.innerHTML = layout(names[page] || 'Panoramica', html);
    document.title = `${names[page] || 'Panoramica'} · Punto`;
  } catch (error) {
    if (n !== renderNumber) return;
    root.innerHTML = layout(
      'Commessa',
      empty('Non possiamo aprire questa commessa.', error.message) +
        '<a class="btn" href="#projects" style="margin-top:20px">Torna alle tue commesse</a>',
    );
  }
}
function openModal(title, html, onSubmit = null, submit = 'Salva', eyebrow = 'PUNTO / WORKSPACE') {
  modalSubmit = onSubmit;
  dialog.innerHTML = `<div class="dialog-head"><div><span class="eyebrow">${eyebrow}</span><h2>${esc(title)}</h2></div><button class="icon-btn" data-action="close" aria-label="Chiudi finestra">×</button></div>${onSubmit ? `<form id="modal-form">${html}<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn ghost" data-action="close">Annulla</button><button class="btn">${esc(submit)}</button></div></form>` : html}`;
  if (!dialog.open) dialog.showModal();
}
async function save(action, data, message = 'Modifica salvata.') {
  await api(action, data);
  dialog.close();
  await refresh();
  toast(message);
}
function projectFields(p = {}) {
  return `<div class="form-grid">${!p.id ? select('Cliente', 'client_id', clientOptions(), p.client_id, 'required') : ''}${field('Nome della commessa', 'title', 'text', p.title || '', 'required maxlength="160"')}${field('Descrizione', 'description', 'textarea', p.description || '')}${field('Scadenza', 'due_date', 'date', p.due_date || '')}${field('Budget in ore', 'budget_hours', 'number', (p.budget_minutes ?? 2400) / 60, 'min="0" max="10000" step="0.25" required')}${
    !p.id
      ? select('Responsabile', 'member_id', [['', 'Scegli una persona'], ...staffOptions()])
      : select(
          'Stato',
          'status',
          [
            ['active', 'In corso'],
            ['completed', 'Completata'],
            ['archived', 'Archiviata'],
          ],
          p.status,
        )
  }${
    !p.id
      ? select('Colore', 'color', [
          ['green', 'Salvia'],
          ['peach', 'Pesca'],
          ['blue', 'Cielo'],
        ])
      : ''
  }</div>`;
}
function taskFields(t = {}) {
  return `<div class="form-grid">${field('Titolo', 'title', 'text', t.title || '', 'required maxlength="160"')}${priority(t.priority)}${field('Descrizione', 'description', 'textarea', t.description || '')}${select('Assegna a', 'assignee_id', [['', 'Non assegnata'], ...detail.members.map((m) => [m.id, m.name])], t.assignee_id)}${field('Scadenza', 'due_date', 'date', t.due_date || '')}${field('Stima in minuti', 'estimate_minutes', 'number', t.estimate_minutes ?? 60, 'required min="0" max="60000"')}</div>`;
}
async function taskModal(id) {
  const data = await api('task', undefined, { id }),
    t = data.task,
    p = state.projects.find((p) => p.id === t.project_id),
    closed = p?.status !== 'active';
  const transitions = isClient()
    ? {
        review: [
          ['done', 'Approva attività'],
          ['doing', 'Richiedi modifiche'],
        ],
        done: [['doing', 'Riapri attività']],
      }[t.status] || []
    : {
        todo: [['doing', 'Inizia attività']],
        doing: [
          ['review', 'Invia in revisione'],
          ['todo', 'Rimetti da fare'],
        ],
        review: [['doing', 'Riprendi attività']],
      }[t.status] || [];
  openModal(
    t.title,
    `<div class="tag-row">${badge(t.status)}${badge(t.priority)}</div><p class="task-detail-desc" style="margin-top:20px">${esc(t.description) || 'Nessuna descrizione.'}</p><div class="detail-meta"><span>Scadenza: ${date(t.due_date)}</span><span>Stima: ${t.estimate_minutes} min</span><span>${esc(state.people.find((u) => u.id === t.assignee_id)?.name || 'Non assegnata')}</span></div>${!closed ? `<div class="toolbar">${transitions.map(([s, label]) => `<button class="btn small" data-task-status="${s}" data-id="${t.id}" data-version="${t.version}">${label}</button>`).join('')}${!isClient() && t.status !== 'done' ? button('Modifica', 'edit-task', t.id, 'ghost small') : ''}</div>` : ''}<h3 class="detail-section">La conversazione</h3><div class="comments">${data.comments.map((c) => `<div class="comment"><span class="avatar">${initials(c.author)}</span><div><strong>${esc(c.author)}</strong><small>${timestamp(c.created_at)}</small><p>${esc(c.body)}</p></div></div>`).join('') || '<p class="muted" style="font-size:12px">Il confronto inizia da un commento.</p>'}</div>${!closed ? `<form class="comment-form" id="comment-form" data-id="${t.id}"><label class="sr" for="comment-body">Aggiungi un commento</label><textarea id="comment-body" name="body" placeholder="Aggiungi un commento…" required maxlength="3000"></textarea><p class="form-error" role="alert"></p><div class="form-actions"><button class="btn small">Invia commento ↗</button></div></form>` : ''}`,
    null,
    '',
    'ATTIVITÀ / ' + esc(p?.title || ''),
  );
}
const actions = {
  close: () => dialog.close(),
  menu: () => {
    const open = document.body.classList.toggle('menu-open');
    document.querySelector('.mobile-toggle').setAttribute('aria-expanded', String(open));
  },
  demo: async (id) => {
    await api('demo', { role: id });
    location.hash = 'overview';
    await refresh();
    window.scrollTo(0, 0);
  },
  logout: async () => {
    await api('logout', {});
    dialog.close();
    state = await api('state');
    login();
  },
  profile: () =>
    openModal(
      'Il tuo account.',
      `<p class="muted">${esc(state.user.name)}<br>${esc(state.user.email)}</p><p>${badge(labels[state.user.role])}</p><div class="toolbar">${button('Cambia password', 'password', '', 'ghost')}${button('Esci dal workspace', 'logout')}</div>`,
    ),
  password: () =>
    openModal(
      'Una nuova password.',
      `<div class="stack">${field('Password attuale', 'current_password', 'password', '', 'required autocomplete="current-password"')}${field('Nuova password', 'password', 'password', '', 'required minlength="12" maxlength="128" autocomplete="new-password"')}<p class="password-note">Almeno 12 caratteri. Conserva la nuova password in un luogo sicuro.</p></div>`,
      (d) => save('password_change', d, 'Password aggiornata.'),
    ),
  'new-client': () =>
    openModal(
      'Un nuovo cliente.',
      `<div class="form-grid">${field('Nome e cognome', 'name', 'text', '', 'required maxlength="120"')}${field('Azienda / Studio', 'company', 'text', '', 'maxlength="120"')}${field('Email', 'email', 'email', '', 'required maxlength="254"')}${field('Note interne', 'notes', 'textarea')}</div>`,
      (d) => save('client_create', d, 'Cliente aggiunto.'),
      'Crea cliente',
    ),
  'new-user': () =>
    openModal(
      'A ciascuno il suo accesso.',
      `<p class="password-note">Crea le credenziali e condividile privatamente. Non viene inviata un’email automatica.</p><div class="form-grid">${field('Nome pubblico', 'name', 'text', '', 'required maxlength="100"')}${field('Email di accesso', 'email', 'email', '', 'required maxlength="254"')}${select(
        'Ruolo',
        'role',
        [
          ['member', 'Team'],
          ['client', 'Cliente'],
        ],
      )}${select('Cliente collegato (per ruolo Cliente)', 'client_id', [['', 'Nessuno'], ...clientOptions()])}${field('Password iniziale', 'password', 'password', '', 'required minlength="12" maxlength="128" autocomplete="new-password"')}</div>`,
      (d) => save('user_create', d, 'Accesso creato. Comunica le credenziali privatamente.'),
      'Crea accesso',
    ),
  'new-project': () => {
    if (!state.clients.length) {
      toast('Aggiungi prima un cliente.');
      goto('clients');
      return;
    }
    openModal(
      'Diamo forma al progetto.',
      projectFields(),
      async (d) => {
        d.budget_minutes = Math.round(Number(d.budget_hours) * 60);
        const p = await api('project_create', d);
        dialog.close();
        state = await api('state');
        currentTab = 'board';
        goto('project/' + p.id);
        toast('Commessa creata.');
      },
      'Crea commessa',
    );
  },
  'new-request': () =>
    openModal(
      'Da dove cominciamo?',
      `<div class="form-grid">${isAdmin() ? select('Cliente', 'client_id', clientOptions(), '', 'required') : ''}${field('La tua idea, in poche parole', 'title', 'text', '', 'required maxlength="160"')}${field('Raccontaci cosa serve', 'description', 'textarea', '', 'required')}${priority()}</div>`,
      (d) => save('request_create', d, 'Richiesta inviata.'),
      'Invia richiesta',
    ),
  'convert-request': (id) => {
    const r = state.requests.find((r) => r.id === id);
    openModal(
      'Da richiesta a commessa.',
      `<div class="note-box"><strong>${esc(r.title)}</strong><br>${esc(r.description)}</div><div class="form-grid">${select('Responsabile', 'member_id', [['', 'Scegli una persona'], ...staffOptions()])}${field('Scadenza', 'due_date', 'date')}${field('Budget in ore', 'budget_hours', 'number', '40', 'required min="0" max="10000" step="0.25"')}</div>`,
      async (d) => {
        const p = await api('request_convert', {
          ...d,
          id,
          version: r.version,
          budget_minutes: Math.round(Number(d.budget_hours) * 60),
        });
        dialog.close();
        state = await api('state');
        currentTab = 'board';
        goto('project/' + p.id);
        toast('Richiesta trasformata in commessa.');
      },
      'Apri commessa',
    );
  },
  'decline-request': (id) => {
    const r = state.requests.find((r) => r.id === id);
    openModal(
      'Non accogliere la richiesta?',
      `<p>La richiesta <strong>${esc(r.title)}</strong> resterà nello storico con stato “Non accolta”.</p>`,
      () => save('request_decline', { id, version: r.version }, 'Richiesta aggiornata.'),
      'Conferma',
    );
  },
  'project-settings': () => {
    const p = detail.project;
    openModal(
      'I dettagli della commessa.',
      `<p class="password-note">Per completare una commessa, tutte le attività e l’ultima consegna devono essere approvate dal cliente.</p>${projectFields(p)}`,
      (d) =>
        save('project_update', {
          ...d,
          project_id: p.id,
          version: p.version,
          budget_minutes: Math.round(Number(d.budget_hours) * 60),
        }),
    );
  },
  'member-add': () =>
    openModal(
      'Una persona in più.',
      select(
        'Aggiungi al team',
        'user_id',
        staffOptions().filter(([id]) => !detail.members.some((m) => m.id === id)),
        '',
        'required',
      ),
      (d) => save('member_add', { ...d, project_id: detail.project.id }, 'Team aggiornato.'),
      'Aggiungi',
    ),
  'new-task': () =>
    openModal(
      'Il prossimo passo.',
      taskFields(),
      (d) => save('task_create', { ...d, project_id: detail.project.id }, 'Attività creata.'),
      'Crea attività',
    ),
  task: taskModal,
  'edit-task': async (id) => {
    const { task: t } = await api('task', undefined, { id });
    detail = await api('project', undefined, { id: t.project_id });
    openModal('Modifica attività.', taskFields(t), (d) =>
      save('task_update', { ...d, id, version: t.version }),
    );
  },
  'new-time': () =>
    openModal(
      'Dai valore al tempo.',
      `<div class="form-grid">${select('Attività', 'task_id', [['', 'Tempo sulla commessa'], ...detail.tasks.map((t) => [t.id, t.title])])}${field('Data', 'work_date', 'date', today(), 'required max="' + today() + '"')}${field('Minuti lavorati', 'minutes', 'number', '60', 'required min="1" max="1440"')}${field('Nota sul lavoro svolto', 'note', 'textarea', '', 'required maxlength="500"')}</div>`,
      (d) => save('time_create', { ...d, project_id: detail.project.id }, 'Tempo registrato.'),
      'Registra tempo',
    ),
  'new-delivery': () =>
    openModal(
      'Una nuova versione.',
      `<div class="stack">${field('Titolo della consegna', 'title', 'text', '', 'required maxlength="160"')}${field('File da condividere', 'file', 'file', '', 'required accept=".pdf,.jpg,.jpeg,.png,.webp"')}<p class="password-note">PDF, JPG, PNG o WebP · Massimo 5 MB e 12 megapixel. Ogni caricamento crea una nuova versione. Il cliente vede il file e può valutarlo.</p></div>`,
      async (d, form) => {
        const data = new FormData(form);
        data.set('project_id', detail.project.id);
        await save('delivery_upload', data, 'Consegna caricata, in attesa del cliente.');
      },
      'Carica consegna',
    ),
  'review-delivery': (id) => {
    const f = detail.deliverables.find((f) => f.id === id);
    openModal(
      'Il tuo riscontro conta.',
      `<div class="note-box">${esc(f.title)} · Versione ${f.revision}<br><a href="api.php?action=download&id=${f.id}"><u>Scarica e verifica il file ↓</u></a></div><div class="stack">${select(
        'La tua decisione',
        'status',
        [
          ['approved', 'Approva consegna'],
          ['changes', 'Richiedi modifiche'],
        ],
      )}${field('Riscontro (obbligatorio per le modifiche)', 'feedback', 'textarea', '', 'maxlength="2000"')}</div>`,
      (d) =>
        save(
          'delivery_review',
          { ...d, id, project_id: detail.project.id, version: f.version },
          'Valutazione registrata.',
        ),
      'Conferma valutazione',
    );
  },
};
document.addEventListener('click', async (event) => {
  const actionEl = event.target.closest('[data-action]'),
    tab = event.target.closest('[data-tab]'),
    status = event.target.closest('[data-task-status]'),
    filterEl = event.target.closest('[data-filter]');
  try {
    if (actionEl) {
      const action = actions[actionEl.dataset.action];
      if (action) {
        actionEl.disabled = true;
        try {
          await action(actionEl.dataset.id);
        } finally {
          actionEl.disabled = false;
        }
      }
    } else if (tab) {
      currentTab = tab.dataset.tab;
      await render();
      document.querySelector('[data-tab="' + currentTab + '"]').focus();
    } else if (filterEl) {
      filter = filterEl.dataset.filter;
      render();
    } else if (status) {
      status.disabled = true;
      await api('task_status', {
        id: status.dataset.id,
        version: status.dataset.version,
        status: status.dataset.taskStatus,
      });
      await refresh();
      await taskModal(status.dataset.id);
      toast('Stato aggiornato.');
    }
  } catch (error) {
    toast(error.message);
    if (status) status.disabled = false;
    if (error.status === 401) {
      dialog.close();
      await refresh();
    }
  }
});
document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!['login-form', 'modal-form', 'comment-form', 'search-form'].includes(form.id)) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (form.id === 'search-form') {
    const q = data.q.toLocaleLowerCase('it').trim(),
      ps = state.projects.filter((p) =>
        (p.title + ' ' + p.client_name).toLocaleLowerCase('it').includes(q),
      ),
      ts = state.tasks.filter((t) => t.title.toLocaleLowerCase('it').includes(q));
    openModal(
      'Risultati per “' + data.q + '”',
      `<div class="search-results">${ps.map((p) => `<a class="task-row" href="#project/${p.id}" data-action="close"><span>↗</span><div><strong>${esc(p.title)}</strong><small>Commessa · ${esc(p.client_name)}</small></div></a>`).join('')}${ts.slice(0, 30).map(taskRow).join('') || (!ps.length ? '<p class="muted">Nessun risultato. Prova con un altro termine.</p>' : '')}</div>`,
    );
    return;
  }
  const submit = form.querySelector('button[type=submit],button:not([type])'),
    errorEl = form.querySelector('.form-error');
  if (submit) submit.disabled = true;
  if (errorEl) errorEl.textContent = '';
  try {
    if (form.id === 'login-form') {
      await api('login', data);
      location.hash = 'overview';
      await refresh();
    } else if (form.id === 'modal-form') {
      await modalSubmit(data, form);
    } else {
      await api('task_comment', { task_id: form.dataset.id, body: data.body });
      await refresh();
      await taskModal(form.dataset.id);
      toast('Commento inviato.');
    }
  } catch (error) {
    if (errorEl) errorEl.textContent = error.message;
    else toast(error.message);
    if (error.status === 419) {
      state = await api('state');
    }
    if (error.status === 401 && form.id !== 'login-form') {
      dialog.close();
      await refresh();
    }
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener('change', async (event) => {
  if (event.target.id === 'demo-role') {
    try {
      await actions.demo(event.target.value);
      toast('Ora stai esplorando il ruolo ' + labels[state.user.role] + '.');
    } catch (error) {
      toast(error.message);
    }
  }
});
window.addEventListener('hashchange', () => {
  document.body.classList.remove('menu-open');
  window.scrollTo(0, 0);
  render();
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
      dialog.close();
  }
});
refresh().catch((error) => {
  root.innerHTML = `<main class="boot" id="main"><span class="brand">punto<i></i></span><h1>Un momento.</h1><p>${esc(error.message)}</p><a class="btn" href="app.php">Riprova</a></main>`;
});

document.addEventListener('keydown', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-tab]')],
      i = tabs.indexOf(tab);
    const n =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[n].click();
  }
  if (event.key === 'Escape') document.body.classList.remove('menu-open');
});
