import {
  dbInterventionsDistinctDates,
  dbInterventionsListByDate,
  dbImportsListRecent
} from '../db.js';
import { centsToEUR } from '../parser.js';

function sumByType(items){
  const out = { INSTALACION:0, REPARACION:0, MANTENIMIENTO:0 };
  for (const it of items){
    out[it.type] = (out[it.type]||0) + (it.total_cents||0);
  }
  return out;
}

export async function viewDashboard(root, { state, setStatus, dbMetaSet }){
  setStatus('Cargando dashboard…');
  const dates = await dbInterventionsDistinctDates();
  const selected = state.selectedDate || dates[dates.length-1] || new Date().toISOString().slice(0,10);
  state.selectedDate = selected;
  await dbMetaSet('last_selected_date', selected);

  const items = await dbInterventionsListByDate(selected);
  const byType = sumByType(items);
  const total = items.reduce((a,x)=>a+(x.total_cents||0),0);
  const recent = await dbImportsListRecent(8);

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <div class="spread">
          <div>
            <h2>Dashboard</h2>
            <div class="muted">Totales por intervenciones únicas (dedupe automático).</div>
          </div>
          <div class="row">
            <label class="small">Día</label>
            <select class="input" id="daySel"></select>
          </div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Total del día</div>
          <div class="value">${centsToEUR(total)}</div>
          <div class="small">${items.length} intervención(es)</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Instalación</div>
          <div class="value">${centsToEUR(byType.INSTALACION||0)}</div>
          <div class="small">Solo INSTALACION</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Reparación + Mantenimiento</div>
          <div class="value">${centsToEUR((byType.REPARACION||0)+(byType.MANTENIMIENTO||0))}</div>
          <div class="small">REPARACION / MANTENIMIENTO</div>
        </div>
      </section>

      <section class="card">
        <h2>Últimos imports</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th><th>Técnico</th><th>Archivo</th><th>Partes</th><th>Total PDF</th><th>Total calc.</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${recent.map(r=>{
              const ok = Math.abs((r.pdf_total_cents||0)-(r.calc_total_cents||0)) <= 1;
              const st = r.parse_errors?.length ? 'bad' : ok ? 'good' : 'warn';
              const label = r.parse_errors?.length ? 'ERROR' : ok ? 'OK' : 'MISMATCH';
              return `
                <tr>
                  <td>${r.date_detected||'—'}</td>
                  <td>${r.tech_detected||'—'}</td>
                  <td class="small">${r.filename||'—'}</td>
                  <td>${r.parts_detected||0}</td>
                  <td>${centsToEUR(r.pdf_total_cents||0)}</td>
                  <td>${centsToEUR(r.calc_total_cents||0)}</td>
                  <td><span class="badge ${st}">${label}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="small" style="margin-top:10px;">
          Si un técnico incluye una instalación compartida en su cierre, no se duplica: se añade como “fuente”.
        </div>
      </section>
    </div>
  `;

  const daySel = root.querySelector('#daySel');
  for (const d of dates.slice().reverse()){
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (d === selected) opt.selected = true;
    daySel.appendChild(opt);
  }
  daySel.addEventListener('change', ()=>{
    state.selectedDate = daySel.value;
    location.hash = '#dashboard';
  });

  setStatus('Listo', 'good');
}
