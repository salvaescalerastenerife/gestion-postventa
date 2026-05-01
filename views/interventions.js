import { dbInterventionsSearch, dbInterventionDelete, dbInterventionPut } from '../db.js';
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
<thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Total</th><th>Techs</th><th>Fuentes</th><th>UID</th><th>Acciones</th></tr></thead>
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
        <td>
        <button class="btn btn-edit-int" data-uid="${it.uid}" type="button">Corregir</button>
          <button class="btn danger btn-del-int" data-uid="${it.uid}" type="button">Borrar</button>
        </td>
      </tr>
    `).join('');

        rows.querySelectorAll('.btn-del-int').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        if (!uid) return;

        const ok = confirm(`¿Seguro que quieres borrar la intervención ${uid}? Esta acción la quitará de todos los informes y listados.`);
        if (!ok) return;

        try {
          await dbInterventionDelete(uid);
          await paint();
          setStatus('Intervención borrada ✅', 'good');
        } catch (e) {
          console.error(e);
          setStatus('Error al borrar la intervención', 'bad');
        }
      });
    });
    rows.querySelectorAll('.btn-edit-int').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        const it = list.find(x => x.uid === uid);
        if (!it) return;

        const newDate = prompt('Fecha de la intervención (YYYY-MM-DD):', it.date || '');
        if (newDate === null) return;

        const newClientId = prompt('Código de cliente:', it.client_id || '');
        if (newClientId === null) return;

        const newClientName = prompt('Nombre cliente:', it.client_name || '');
        if (newClientName === null) return;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate.trim())) {
          alert('La fecha debe tener formato YYYY-MM-DD');
          return;
        }

        if (!String(newClientId).trim()) {
          alert('El código de cliente no puede estar vacío.');
          return;
        }

        const updated = {
          ...it,
          date: newDate.trim(),
          client_id: String(newClientId).trim(),
          client_name: String(newClientName || '').trim(),
          corrected_at: new Date().toISOString(),
          is_corrected: true
        };

        try {
          await dbInterventionPut(updated);
          await paint();
          setStatus('Intervención corregida ✅', 'good');
        } catch (e) {
          console.error(e);
          setStatus('Error al guardar corrección', 'bad');
        }
      });
    });
    setStatus(`Listo · ${list.length} resultado(s)`, 'good');
  }

  run.addEventListener('click', paint);
  await paint();
}
