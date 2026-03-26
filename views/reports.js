import { dbInterventionsSearch } from '../db.js';
import { centsToEUR } from '../parser.js';
// --- MAPA DE BATERÍAS (desde app técnicos) ---
const BATTERY_TYPES = [
  { cents: 3684, type: '12V 2Amp' },
  { cents: 7315, type: '12V 9Amp' },
  { cents: 10810, type: '12V 12Amp' },
  { cents: 12642, type: '12V 18Amp' }
];

// --- Resolver combinación exacta de baterías ---
function resolveBatteryCombination(totalCents) {
  if (!totalCents || totalCents <= 0) {
    return { ok: true, units: 0, breakdown: {} };
  }

  const maxUnits = 6; // límite razonable por intervención
  let best = null;

  function dfs(idx, remaining, current) {
    if (remaining === 0) {
      const totalUnits = Object.values(current).reduce((a, b) => a + b, 0);

      if (!best || totalUnits < best.units) {
        best = {
          ok: true,
          units: totalUnits,
          breakdown: { ...current }
        };
      }
      return;
    }

    if (remaining < 0 || idx >= BATTERY_TYPES.length) return;

    const { cents, type } = BATTERY_TYPES[idx];

    for (let n = 0; n <= maxUnits; n++) {
      const nextRemaining = remaining - (cents * n);
      if (nextRemaining < 0) break;

      current[type] = n;
      dfs(idx + 1, nextRemaining, current);
      current[type] = 0;
    }
  }

  dfs(0, totalCents, {});

  if (!best) {
    return { ok: false, units: 0, breakdown: {} };
  }

  return best;
}
export async function viewReports(root, { setStatus }) {
  setStatus('Cargando informes…');

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <div class="spread">
          <div>
            <h2>Informes</h2>
            <div class="muted">Totales facturados por intervención dentro del rango seleccionado.</div>
          </div>
          <div class="row">
            <input class="input" id="client" placeholder="Cliente contiene…" />
            <input class="input" id="from" type="date" />
            <input class="input" id="to" type="date" />
            <select class="input" id="type">
              <option value="">Tipo (todos)</option>
              <option value="INSTALACION">INSTALACION</option>
              <option value="REPARACION">REPARACION</option>
              <option value="MANTENIMIENTO">MANTENIMIENTO</option>
            </select>
            <button class="btn primary" id="run">Generar</button>
          </div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Total general</div>
          <div class="value" id="kTotal">0,00 €</div>
          <div class="small">Rango seleccionado</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Instalación</div>
          <div class="value" id="kInst">0,00 €</div>
          <div class="small" id="kInstN">0 intervenciones</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Reparación</div>
          <div class="value" id="kRep">0,00 €</div>
          <div class="small" id="kRepN">0 intervenciones</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Mantenimiento</div>
          <div class="value" id="kMant">0,00 €</div>
          <div class="small" id="kMantN">0 intervenciones</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Comidas</div>
          <div class="value" id="kFood">0,00 €</div>
          <div class="small">Gasto total en alimentación</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Materiales</div>
          <div class="value" id="kMaterial">0,00 €</div>
          <div class="small">Gasto total en materiales</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Baterías</div>
          <div class="value" id="kBattery">0,00 €</div>
          <div class="small">Gasto total en baterías</div>
        </div>
      </section>
<section class="card span4">
  <div class="kpi">
    <div class="label">Unidades baterías</div>
    <div class="value" id="kBatteryUnits">0</div>
    <div class="small">Total estimado</div>
  </div>
</section>

<section class="card span4">
  <div class="kpi">
    <div class="label">Desglose baterías</div>
    <div class="small" id="kBatteryBreakdown">—</div>
  </div>
</section>
      <section class="card">
        <div class="spread" style="margin-bottom:10px;">
          <h2 style="margin:0;">Detalle</h2>
          <button class="btn" id="btnPdf" type="button">Exportar PDF</button>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Intervenciones</th>
              <th>Total</th>
              <th>% del total</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </section>
    </div>
  `;

  const rows = root.querySelector('#rows');
  const run = root.querySelector('#run');
  const btnPdf = root.querySelector('#btnPdf');

  const kTotal = root.querySelector('#kTotal');
  const kInst = root.querySelector('#kInst');
  const kRep = root.querySelector('#kRep');
  const kMant = root.querySelector('#kMant');

  const kInstN = root.querySelector('#kInstN');
  const kRepN = root.querySelector('#kRepN');
  const kMantN = root.querySelector('#kMantN');

  const kFood = root.querySelector('#kFood');
  const kMaterial = root.querySelector('#kMaterial');
  const kBattery = root.querySelector('#kBattery');
const kBatteryUnits = root.querySelector('#kBatteryUnits');
const kBatteryBreakdown = root.querySelector('#kBatteryBreakdown');
  let currentList = [];

  async function paint() {
    setStatus('Calculando informe…');

    const client = root.querySelector('#client').value.trim() || null;
    const from = root.querySelector('#from').value || null;
    const to = root.querySelector('#to').value || null;
    const type = root.querySelector('#type').value || null;

    const list = await dbInterventionsSearch({
      client,
      from,
      to,
      type
    });

    currentList = list;

    const resumen = {
      INSTALACION: { total_cents: 0, count: 0 },
      REPARACION: { total_cents: 0, count: 0 },
      MANTENIMIENTO: { total_cents: 0, count: 0 },
    };

    let totalFoodCents = 0;
    let totalMaterialCents = 0;
    let totalBatteryCents = 0;
let totalBatteryUnits = 0;
const batteryTotalsByType = {};
let unresolvedBattery = 0;
    for (const it of list) {
      const key = it.type;
      if (resumen[key]) {
        resumen[key].count += 1;
        resumen[key].total_cents += Number(it.total_cents || 0);
      }

      const breakdown = it.breakdown_cents || {};
      totalFoodCents += Number(breakdown.comida || 0);
      totalMaterialCents += Number(breakdown.material || 0);
      totalBatteryCents += Number(breakdown.bateria || 0);
      const batteryCents = Number(breakdown.bateria || 0);

if (batteryCents > 0) {
  const res = resolveBatteryCombination(batteryCents);

  if (res.ok) {
    totalBatteryUnits += res.units;

    Object.entries(res.breakdown).forEach(([type, n]) => {
      if (!n) return;
      batteryTotalsByType[type] = (batteryTotalsByType[type] || 0) + n;
    });
  } else {
    unresolvedBattery += batteryCents;
  }
}
    }

    const totalGeneral =
      resumen.INSTALACION.total_cents +
      resumen.REPARACION.total_cents +
      resumen.MANTENIMIENTO.total_cents;

    kTotal.textContent = centsToEUR(totalGeneral);
    kInst.textContent = centsToEUR(resumen.INSTALACION.total_cents);
    kRep.textContent = centsToEUR(resumen.REPARACION.total_cents);
    kMant.textContent = centsToEUR(resumen.MANTENIMIENTO.total_cents);

    kInstN.textContent = `${resumen.INSTALACION.count} intervenciones`;
    kRepN.textContent = `${resumen.REPARACION.count} intervenciones`;
    kMantN.textContent = `${resumen.MANTENIMIENTO.count} intervenciones`;

    kFood.textContent = centsToEUR(totalFoodCents);
    kMaterial.textContent = centsToEUR(totalMaterialCents);
    kBattery.textContent = centsToEUR(totalBatteryCents);
kBatteryUnits.textContent = totalBatteryUnits;

const breakdownText = Object.entries(batteryTotalsByType)
  .sort((a, b) => b[1] - a[1])
  .map(([type, n]) => `${type}: ${n}`)
  .join(' · ') || '—';

kBatteryBreakdown.textContent = breakdownText;
    const pct = (n) => {
      if (!totalGeneral) return '0 %';
      return `${((n / totalGeneral) * 100).toFixed(1).replace('.', ',')} %`;
    };

    rows.innerHTML = `
      <tr>
        <td>INSTALACION</td>
        <td>${resumen.INSTALACION.count}</td>
        <td>${centsToEUR(resumen.INSTALACION.total_cents)}</td>
        <td>${pct(resumen.INSTALACION.total_cents)}</td>
      </tr>
      <tr>
        <td>REPARACION</td>
        <td>${resumen.REPARACION.count}</td>
        <td>${centsToEUR(resumen.REPARACION.total_cents)}</td>
        <td>${pct(resumen.REPARACION.total_cents)}</td>
      </tr>
      <tr>
        <td>MANTENIMIENTO</td>
        <td>${resumen.MANTENIMIENTO.count}</td>
        <td>${centsToEUR(resumen.MANTENIMIENTO.total_cents)}</td>
        <td>${pct(resumen.MANTENIMIENTO.total_cents)}</td>
      </tr>
    `;

    setStatus(`Listo · ${list.length} intervención(es) analizadas`, 'good');
  }

  run.addEventListener('click', paint);

  btnPdf?.addEventListener('click', async () => {
    const jsPDFLib = window.jspdf?.jsPDF;

    if (!jsPDFLib) {
      alert('Error cargando el generador de PDF. Recarga la app.');
      return;
    }

    const doc = new jsPDFLib({ unit: 'mm', format: 'a4' });

    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Informe de facturación', 14, y);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Total general: ${kTotal.textContent}`, 14, y);

    const client = root.querySelector('#client')?.value?.trim() || 'Todos';
    const from = root.querySelector('#from')?.value || '—';
    const to = root.querySelector('#to')?.value || '—';
    const type = root.querySelector('#type')?.value || 'TODOS';

    y += 8;
    doc.text(`Cliente: ${client}`, 14, y);
    y += 6;
    doc.text(`Desde: ${from}`, 14, y);
    y += 6;
    doc.text(`Hasta: ${to}`, 14, y);
    y += 6;
    doc.text(`Tipo: ${type}`, 14, y);

    y += 8;
    doc.text(`Comidas: ${kFood.textContent}`, 14, y);
    y += 6;
    doc.text(`Materiales: ${kMaterial.textContent}`, 14, y);
    y += 6;
    doc.text(`Baterías: ${kBattery.textContent}`, 14, y);

    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Tipo', 14, y);
    doc.text('Intervenciones', 80, y);
    doc.text('Total', 135, y);
    doc.text('% del total', 170, y);

    y += 4;
    doc.line(14, y, 196, y);
    y += 8;

    const trs = Array.from(rows.querySelectorAll('tr'));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    trs.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 4) return;

      const tipoTxt = (tds[0].textContent || '').trim();
      const intervenciones = (tds[1].textContent || '').trim();
      const totalTxt = (tds[2].textContent || '').trim();
      const pctTxt = (tds[3].textContent || '').trim();

      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      doc.text(tipoTxt, 14, y);
      doc.text(intervenciones, 80, y);
      doc.text(totalTxt, 135, y);
      doc.text(pctTxt, 170, y);

      y += 8;
    });

    let yTech = y + 10;

    const techTotals = {};

    (Array.isArray(currentList) ? currentList : []).forEach((it) => {
      const rawTechs = Array.isArray(it?.techs_in_part) ? it.techs_in_part : [];
      const techs = rawTechs
        .map(t => String(t || '').trim())
        .filter(Boolean);

      const total = Number(it?.total_cents || 0);

      if (!techs.length) return;
      if (!Number.isFinite(total) || total <= 0) return;

      const share = total / techs.length;

      techs.forEach((t) => {
        techTotals[t] = (techTotals[t] || 0) + share;
      });
    });

    const techEntries = Object.entries(techTotals)
      .filter(([tech, total]) => tech && Number.isFinite(total))
      .sort((a, b) => b[1] - a[1]);

    if (techEntries.length) {
      if (yTech > 270) {
        doc.addPage();
        yTech = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Facturación por técnico', 14, yTech);

      yTech += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      techEntries.forEach(([tech, total]) => {
        if (yTech > 280) {
          doc.addPage();
          yTech = 20;
        }

        doc.text(`${tech}: ${centsToEUR(Math.round(total))}`, 14, yTech);
        yTech += 6;
      });
    }

    const safeFrom = from === '—' ? 'sin-desde' : from;
    const safeTo = to === '—' ? 'sin-hasta' : to;
    const filename = `informe_${safeFrom}_${safeTo}.pdf`;

    doc.save(filename);
  });

  await paint();
}
