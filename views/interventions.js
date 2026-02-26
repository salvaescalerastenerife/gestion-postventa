import { dbInterventionsSearch } from '../db.js';
import { centsToEUR } from '../parser.js';

export async function viewInterventions(root, { setStatus }){
  setStatus('Cargando intervenciones…');

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <div class="spread">
          <div>
            <h2>Intervenciones</h2>
            <div class="muted">Filtro global. (V1: scan local, suficiente para uso normal).</div>
          </div>
          <div class="row">
            <input class="input" id="client" placeholder="Cliente contiene…" />
            <select class="input" id="type">
              <option value="">Tipo (todos)</option>
              <option value="INSTALACION">INSTALACION</option>
              <option value="REPARACION">REPARACION</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            </select>
            <input class="input" id="from" type="date" />
            <input class="input" id="to" type="date" />
            <button class="btn primary" id="run">Buscar</button>
          </div>
        </div>
      </section>

      <section class="card">
        <table class="table">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Total</th><th>Techs</th><th>Fuentes</th><th>UID</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </section>
    </div>
  `;

  const rows = root.querySelector('#rows');
  const run = root.querySelector('#run');

  async function paint(){
    setStatus('Buscando…');
    const client = root.querySelector('#client').value.trim() || null;
    const type = root.querySelector('#type').value || null;
    const from = root.querySelector('#from').value || null;
    const to = root.querySelector('#to').value || null;

    const list = await dbInterventionsSearch({ client, from, to, type });

    rows.innerHTML = list.slice(0, 200).map(it=>`
      <tr>
        <td>${it.date}</td>
        <td>${it.type}</td>
        <td>${it.client_id}</td>
        <td>${centsToEUR(it.total_cents||0)}</td>
        <td class="small">${(it.techs_in_part||[]).join(' + ') || '—'}</td>
        <td>${(it.sources||[]).length}</td>
        <td class="small">${it.uid}</td>
      </tr>
    `).join('');

    setStatus(`Listo · ${list.length} resultado(s)`, 'good');
  }

  run.addEventListener('click', paint);
  await paint();
}
