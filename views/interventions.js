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
            <div id="editModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; padding:16px;">
        <div style="background:#2a1a0d; color:#fff4e8; max-width:420px; margin:40px auto; padding:16px; border-radius:16px; border:1px solid rgba(255,214,170,.14);">
          <h3 style="margin-top:0;">Corregir intervención</h3>
<div class="field onecol">
  <label>Fecha</label>
  <input id="m_date" class="input" type="date">
</div>

<div class="field onecol">
  <label>ID Cliente</label>
  <input id="m_client" class="input" type="text">
</div>

<div class="field onecol">
  <label>Nombre cliente</label>
  <input id="m_name" class="input" type="text">
</div>
<div class="hr"></div>

<div class="field onecol">
  <label>Horas base</label>
  <input id="m_horas" class="input" type="number" step="0.1">
</div>

<div class="field onecol">
  <label>Horas desplazamiento</label>
  <input id="m_despl" class="input" type="number" step="0.1">
</div>

<div class="field onecol">
  <label>Kilómetros</label>
  <input id="m_km" class="input" type="number" step="1">
</div>

<div class="field onecol">
  <label>Comida / Almuerzo</label>
  <input id="m_comida" class="input" type="number" step="0.01">
</div>

<div class="field onecol">
  <label>Cena</label>
  <input id="m_cena" class="input" type="number" step="0.01">
</div>

<div class="field onecol">
  <label>Material / Consumibles</label>
  <input id="m_material" class="input" type="number" step="0.01">
</div>
          <div style="display:flex; gap:8px; margin-top:12px;">
<button id="m_save" class="btn primary" type="button">Guardar</button>
<button id="m_cancel" class="btn" type="button">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const rows = root.querySelector('#rows');
  const run = root.querySelector('#run');
const editModal = root.querySelector('#editModal');
const mCancel = root.querySelector('#m_cancel');
 const mSave = root.querySelector('#m_save');
  const mDate = root.querySelector('#m_date');
const mClient = root.querySelector('#m_client');
const mName = root.querySelector('#m_name');
 const mHoras = root.querySelector('#m_horas');
const mDespl = root.querySelector('#m_despl');
const mKm = root.querySelector('#m_km');
const mComida = root.querySelector('#m_comida');
const mCena = root.querySelector('#m_cena');
const mMaterial = root.querySelector('#m_material');
  mCancel.addEventListener('click', () => {
  editModal.style.display = 'none';
});
  mSave.addEventListener('click', async () => {
  if (!window.currentEdit) return;

  const fm = window.currentEdit.fax_meta || {};
const toNum = (v) => Number(String(v || '0').replace(',', '.')) || 0;
const toCents = (v) => Math.round(toNum(v) * 100);

const horas = toNum(mHoras.value);
const despl = toNum(mDespl.value);
const km = toNum(mKm.value);
const comida = toCents(mComida.value);
const cena = toCents(mCena.value);
const material = toCents(mMaterial.value);

const baseRate = Number(fm.horas_base_rate || (window.currentEdit.type === 'REPARACION' ? 32.14 : 27.95));
const baseMult = Number(fm.horas_base_mult || (window.currentEdit.type === 'INSTALACION' ? 2 : 1));
const desplRate = Number(fm.horas_despl_rate || 19.28);
const desplMult = Number(fm.horas_despl_mult || (window.currentEdit.type === 'INSTALACION' ? 2 : 1));
const kmRate = Number(fm.km_rate || 0.31);

const baseTotal = Math.round(horas * baseRate * baseMult * 100);
const desplTotal = Math.round(despl * desplRate * desplMult * 100);
const kmTotal = Math.round(km * kmRate * 100);

const oldFurgon = Number(fm.furgon_cents || 0);
const oldBateria = Number(fm.bateria_cents || 0);
const oldPilas = Number(fm.pilas_total_cents || 0);
const oldParking = Number(fm.parking_cents || 0);
const oldGasolina = Number(fm.gasolina_cents || 0);
const oldAlquiler = Number(fm.alquiler_coche_cents || 0);
const oldMantenimiento = Number(fm.mantenimiento_fijo_cents || 0);

const newFaxMeta = {
  ...fm,
  horas_base_h: horas,
  horas_base_total_cents: baseTotal,
  horas_despl_h: despl,
  horas_despl_total_cents: desplTotal,
  km_units: km,
  km_total_cents: kmTotal,
  almuerzo_cents: comida,
  comida_cents: 0,
  cena_cents: cena,
  material_cents: material
};

const newTotal =
  baseTotal +
  desplTotal +
  kmTotal +
  comida +
  cena +
  material +
  oldFurgon +
  oldBateria +
  oldPilas +
  oldParking +
  oldGasolina +
  oldAlquiler +
  oldMantenimiento;

const updated = {
  ...window.currentEdit,
  date: mDate.value,
  client_id: mClient.value.trim(),
  client_name: mName.value.trim(),
  fax_meta: newFaxMeta,
  total_cents: newTotal,
  is_corrected: true,
  corrected_at: new Date().toISOString()
};

  try {
    await dbInterventionPut(updated);
    editModal.style.display = 'none';
    await paint();
    setStatus('Intervención actualizada ✅', 'good');
  } catch (e) {
    console.error(e);
    setStatus('Error al guardar', 'bad');
  }
});
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
  window.currentEdit = it;
    if (!it) return;

const fm = it.fax_meta || {};

mDate.value = it.date || '';
mClient.value = it.client_id || '';
mName.value = it.client_name || '';

mHoras.value = fm.horas_base_h ?? 0;
mDespl.value = fm.horas_despl_h ?? 0;
mKm.value = fm.km_units ?? 0;
mComida.value = ((fm.almuerzo_cents || fm.comida_cents || 0) / 100).toFixed(2);
mCena.value = ((fm.cena_cents || 0) / 100).toFixed(2);
mMaterial.value = ((fm.material_cents || 0) / 100).toFixed(2);

editModal.style.display = 'block';
  });
});
    setStatus(`Listo · ${list.length} resultado(s)`, 'good');
  }

  run.addEventListener('click', paint);
  await paint();
}
