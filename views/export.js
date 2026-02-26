import { dbInterventionsSearch, dbInterventionsListByDate } from '../db.js';
import { interventionsToCSV, downloadTextFile } from '../csv.js';

export async function viewExport(root, { state, setStatus }){
  setStatus('Exportar…');

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <h2>Exportar CSV</h2>
        <div class="muted">Una línea por intervención (ya deduplicada).</div>
        <div class="hr"></div>

        <div class="row">
          <button class="btn primary" id="day">CSV del día seleccionado</button>

          <label class="small">Desde</label>
          <input class="input" id="from" type="date" />

          <label class="small">Hasta</label>
          <input class="input" id="to" type="date" />

          <button class="btn" id="range">CSV rango</button>
        </div>

        <div class="small" style="margin-top:10px;">
          Día seleccionado: <b>${state.selectedDate || '—'}</b>
        </div>
      </section>
    </div>
  `;

  root.querySelector('#day').addEventListener('click', async ()=>{
    const d = state.selectedDate;
    if (!d){ alert('No hay día seleccionado.'); return; }
    setStatus('Generando CSV…');
    const rows = await dbInterventionsListByDate(d);
    const csv = interventionsToCSV(rows);
    downloadTextFile(`intervenciones_${d}.csv`, csv, 'text/csv');
    setStatus('CSV descargado ✅', 'good');
  });

  root.querySelector('#range').addEventListener('click', async ()=>{
    const from = root.querySelector('#from').value || null;
    const to = root.querySelector('#to').value || null;
    if (!from && !to){ alert('Selecciona al menos Desde o Hasta.'); return; }
    setStatus('Generando CSV…');
    const rows = await dbInterventionsSearch({ from, to });
    const csv = interventionsToCSV(rows);
    const name = `intervenciones_${from||'start'}_${to||'end'}.csv`;
    downloadTextFile(name, csv, 'text/csv');
    setStatus('CSV descargado ✅', 'good');
  });

  setStatus('Listo', 'good');
}
