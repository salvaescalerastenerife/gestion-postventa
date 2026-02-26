import { dbInit, dbMetaGet, dbMetaSet } from './db.js';
import { viewDashboard } from './views/dashboard.js';
import { viewImport } from './views/import.js';
import { viewClients } from './views/clients.js';
import { viewInterventions } from './views/interventions.js';
import { viewExport } from './views/export.js';
import { viewBackup } from './views/backup.js';

const appEl = document.getElementById('app');
const statusEl = document.getElementById('status-pill');
const footerEl = document.getElementById('footer-meta');

const VIEWS = {
  dashboard: viewDashboard,
  import: viewImport,
  clients: viewClients,
  interventions: viewInterventions,
  export: viewExport,
  backup: viewBackup
};

export const state = {
  selectedDate: null,     // YYYY-MM-DD
  selectedClient: null,   // string
  preImport: []           // filled by Import view
};

export function setStatus(text, kind = 'neutral'){
  statusEl.textContent = text;
  statusEl.style.borderColor =
    kind === 'good' ? 'rgba(34,197,94,.35)' :
    kind === 'warn' ? 'rgba(245,158,11,.35)' :
    kind === 'bad'  ? 'rgba(239,68,68,.35)' :
    'rgba(255,255,255,.10)';
  statusEl.style.background =
    kind === 'good' ? 'rgba(34,197,94,.12)' :
    kind === 'warn' ? 'rgba(245,158,11,.12)' :
    kind === 'bad'  ? 'rgba(239,68,68,.12)' :
    'rgba(255,255,255,.06)';
}

function setActiveTab(tab){
  document.querySelectorAll('.tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab === tab);
  });
}

async function boot(){
  setStatus('Iniciando…');
  await dbInit();

  // selected date: last imported day, else today
  const lastDay = await dbMetaGet('last_selected_date');
  if (lastDay) state.selectedDate = lastDay;

  footerEl.textContent = 'IndexedDB local · Safari OK · Sin backend';
  setStatus('Listo', 'good');

  // Tabs
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const tab = btn.dataset.tab;
      location.hash = `#${tab}`;
    });
  });

  // Hash routing (simple)
  window.addEventListener('hashchange', renderFromHash);

  await renderFromHash();
}

async function renderFromHash(){
  const tab = (location.hash || '#dashboard').replace('#','');
  const view = VIEWS[tab] || VIEWS.dashboard;

  setActiveTab(tab);
  appEl.innerHTML = '';
  await view(appEl, { state, setStatus, dbMetaSet });
}

boot();
