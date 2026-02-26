import { dbInterventionsListByClient, dbInterventionsSearch } from '../db.js';
import { centsToEUR } from '../parser.js';

export async function viewClients(root, { state, setStatus }){
  setStatus('Cargando clientes…');

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <div class="spread">
          <div>
            <h2>Clientes</h2>
            <div class="muted">Busca por ID (solo ID estable).</div>
          </div>
          <div class="row">
            <input class="input" id="q" placeholder="ID cliente…" />
            <button class="btn primary" id="go">Abrir</button>
          </div>
        </div>
      </section>

      <section class="card" id="clientCard" style="display:none;"></section>

      <section class="card">
        <h2>Recientes (últimas intervenciones)</h2>
        <div class="small">Tip: escribe el ID exacto y pulsa “Abrir”.</div>
        <div class="hr"></div>
        <div id="recent"></div>
      </section>
    </div>
  `;

  const q = root.querySelector('#q');
  const go = root.querySelector('#go');
  const clientCard = root.querySelector('#clientCard');
  const recent = root.querySelector('#recent');

  async function renderClient(clientId){
    if (!clientId) return;

    const items = await dbInterventionsListByClient(clientId);
    const total = items.reduce((a,x)=>a+(x.total_cents||0),0);
    const last = items[0]?.date || '—';

    clientCard.style.display = '';
    clientCard.innerHTML = `
      <div class="spread">
        <div>
          <h2>Cliente ${clientId}</h2>
          <div class="small">${items.length} intervención(es) · Última: ${last}</div>
        </div>
        <div class="kpi" style="min-width:240px;">
          <div class="label">Total acumulado</div>
          <div class="value">${centsToEUR(total)}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="row">
        <label class="small">Tipo</label>
        <select class="input" id="type">
          <option value="">Todos</option>
          <option value="INSTALACION">INSTALACION</option>
          <option value="REPARACION">REPARACION</option>
          <option value="MANTENIMIENTO">MANTENIMIENTO</option>
        </select>

        <label class="small">Desde</label>
        <input class="input" id="from" type="date" />

        <label class="small">Hasta</label>
        <input class="input" id="to" type="date" />

        <button class="btn" id="apply">Aplicar</button>
      </div>

      <div class="hr"></div>

      <table class="table">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Total</th><th>Fuentes</th><th>UID</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    `;

    const typeEl = clientCard.querySelector('#type');
    const fromEl = clientCard.querySelector('#from');
    const toEl = clientCard.querySelector('#to');
    const apply = clientCard.querySelector('#apply');
    const rows = clientCard.querySelector('#rows');

    async function paint(){
      const type = typeEl.value || null;
      const from = fromEl.value || null;
      const to = toEl.value || null;

      const list = await dbInterventionsListByClient(clientId, { from, to, type });
      rows.innerHTML = list.map(it=>`
        <tr>
          <td>${it.date}</td>
          <td>${it.type}</td>
          <td>${centsToEUR(it.total_cents||0)}</td>
          <td>${(it.sources||[]).length}</td>
          <td class="small">${it.uid}</td>
        </tr>
      `).join('');
    }

    apply.addEventListener('click', paint);
    await paint();
    setStatus('Listo', 'good');
  }

  go.addEventListener('click', ()=> renderClient(q.value.trim()));
  q.addEventListener('keydown', (e)=>{ if (e.key==='Enter') renderClient(q.value.trim()); });

  // Recientes (scan last 30 interventions)
  const recentItems = await dbInterventionsSearch({}).then(x=>x.slice(0, 30));
  const grouped = new Map();
  for (const it of recentItems){
    if (!grouped.has(it.client_id)) grouped.set(it.client_id, { client_id: it.client_id, last: it.date, count:0, total:0 });
    const g = grouped.get(it.client_id);
    g.count += 1;
    g.total += (it.total_cents||0);
    if (it.date > g.last) g.last = it.date;
  }
  const list = Array.from(grouped.values()).sort((a,b)=> (a.last < b.last ? 1 : -1)).slice(0, 20);

  recent.innerHTML = `
    <table class="table">
      <thead><tr><th>Cliente</th><th>Última</th><th>Intervenciones</th><th>Total</th></tr></thead>
      <tbody>
        ${list.map(x=>`
          <tr style="cursor:pointer" data-id="${x.client_id}">
            <td>${x.client_id}</td>
            <td>${x.last}</td>
            <td>${x.count}</td>
            <td>${centsToEUR(x.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  recent.querySelectorAll('tr[data-id]').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      const id = tr.dataset.id;
      q.value = id;
      renderClient(id);
    });
  });

  setStatus('Listo', 'good');
}
