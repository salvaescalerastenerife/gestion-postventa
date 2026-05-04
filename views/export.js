import { dbInterventionsSearch, dbInterventionsListByDate, dbInterventionsPutMany } from '../db.js';
import { interventionsToCSV, downloadTextFile } from '../csv.js';
import { buildFaxMonthlyText } from '../fax-report.js';

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
<button class="btn btn-danger-special" id="repairTotals">⚠ Reparar totales</button>
  <label class="small">Desde</label>
  <input class="input" id="from" type="date" />

  <label class="small">Hasta</label>
  <input class="input" id="to" type="date" />

  <button class="btn" id="range">CSV rango</button>
  <button class="btn" id="faxMonth">Documento mensual Bernardo</button>
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
root.querySelector('#faxMonth').addEventListener('click', async () => {
  const from = root.querySelector('#from').value;
  const to = root.querySelector('#to').value;

  if (!from && !to) {
    alert('Selecciona al menos una fecha dentro del mes.');
    return;
  }

  const jsPDFLib = window.jspdf?.jsPDF;
  if (!jsPDFLib) {
    alert('No se pudo cargar jsPDF.');
    return;
  }

  setStatus('Generando documento mensual…');

  const rows = await dbInterventionsSearch({ from, to });
  const refDate = from || to;
  const [year, month] = refDate.split('-');

  const txt = buildFaxMonthlyText(rows, { year, month });
  const lines = txt.split('\n');

const doc = new jsPDFLib({ unit: 'mm', format: 'a4' });

const loadLogoDataUrl = async () => {
  const res = await fetch('./logo_transparent_v2.png');
  if (!res.ok) throw new Error('No se pudo cargar el logo');
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

try {
  const logo = await loadLogoDataUrl();
  doc.addImage(logo, 'PNG', 14, 8, 60, 20);
} catch (e) {
  console.warn('Logo no cargado:', e);
}

const M = 14;
const maxW = 182;
let y = 35;

  const ensurePage = (extra = 6) => {
  if (y + extra > 285) {
    doc.addPage();
    y = 18;
  }
};

  for (const rawLine of lines) {
    let line = rawLine;
    let isBold = false;
    let isTitle = false;

    if (line.startsWith('[[BOLD]]')) {
      isBold = true;
      line = line.replace('[[BOLD]]', '');
    }

    if (line.startsWith('[[TITLE]]')) {
      isTitle = true;
      line = line.replace('[[TITLE]]', '');
    }

    ensurePage(isTitle ? 8 : 6);

    if (!line.trim()) {
      y += 10;
      continue;
    }

    if (isTitle) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);

  const wrappedTitle = doc.splitTextToSize(line, maxW);
  doc.text(wrappedTitle, M, y);

  let underlineY = y + 1;
  for (const titleLine of wrappedTitle) {
    const textWidth = doc.getTextWidth(titleLine);
    doc.setLineWidth(0.3);
    doc.line(M, underlineY, M + textWidth, underlineY);
    underlineY += 5;
  }

  y += wrappedTitle.length * 5 + 2;
  continue;
}

    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(11);

    const wrapped = doc.splitTextToSize(line, maxW);
    doc.text(wrapped, M, y);
    y += wrapped.length * 5;
  }

  const name = `fax_${year}_${month}.pdf`;
  doc.save(name);

  setStatus('Documento generado ✅', 'good');
});

// 🔴 BOTÓN REPARAR TOTALES (AQUÍ)
root.querySelector('#repairTotals').addEventListener('click', async () => {
  const ok = confirm('⚠ Esto recalculará todos los totales desde los datos internos. ¿Continuar?');
  if (!ok) return;

  setStatus('Reparando totales…');

  const rows = await dbInterventionsSearch({});

  const fixed = rows.map(it => {
    const fm = it.fax_meta || {};
const hasUsefulFaxMeta =
  Number(fm.horas_base_total_cents || 0) > 0 ||
  Number(fm.horas_despl_total_cents || 0) > 0 ||
  Number(fm.km_total_cents || 0) > 0 ||
  Number(fm.almuerzo_cents || 0) > 0 ||
  Number(fm.comida_cents || 0) > 0 ||
  Number(fm.cena_cents || 0) > 0 ||
  Number(fm.material_cents || 0) > 0 ||
  Number(fm.bateria_cents || 0) > 0 ||
  Number(fm.furgon_cents || 0) > 0 ||
  Number(fm.mantenimiento_fijo_cents || 0) > 0;

if (!hasUsefulFaxMeta) {
  return it;
}
    const base = Number(fm.horas_base_total_cents || 0);
    const despl = Number(fm.horas_despl_total_cents || 0);
    const km = Number(fm.km_total_cents || 0);
    const comida = Number(fm.almuerzo_cents || fm.comida_cents || 0);
    const cena = Number(fm.cena_cents || 0);
    const material = Number(fm.material_cents || 0);

    const bateria = Number(fm.bateria_cents || 0);
    const furgon = Number(fm.furgon_cents || 0);
    const pilas = Number(fm.pilas_total_cents || 0);
    const parking = Number(fm.parking_cents || 0);
    const gasolina = Number(fm.gasolina_cents || 0);
    const alquiler = Number(fm.alquiler_coche_cents || 0);
    const fijo = Number(fm.mantenimiento_fijo_cents || 0);

    const type = it.type;

    const breakdown = {
      instalacion: type === 'INSTALACION' ? base : 0,
      reparacion: type === 'REPARACION' ? base : 0,
      fijo: type === 'MANTENIMIENTO' ? base : 0,

      desplazamiento: despl,
      km: km,
      comida: comida + cena,
      material: material,
      bateria: bateria,
      furgon: furgon,
      fijo_extra: fijo
    };

    const total =
      base +
      despl +
      km +
      comida +
      cena +
      material +
      bateria +
      furgon +
      pilas +
      parking +
      gasolina +
      alquiler +
      fijo;

    return {
      ...it,
      breakdown_cents: breakdown,
      total_cents: total
    };
  });

  await dbInterventionsPutMany(fixed);

  setStatus('Totales reparados correctamente ✅', 'good');
});

setStatus('Listo', 'good');
}
