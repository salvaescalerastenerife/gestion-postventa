import { dbInterventionsSearch } from '../db.js';
import { centsToEUR } from '../parser.js';


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

    const resumen = {
      INSTALACION: { total_cents: 0, count: 0 },
      REPARACION: { total_cents: 0, count: 0 },
      MANTENIMIENTO: { total_cents: 0, count: 0 },
    };

    for (const it of list) {
      const key = it.type;
      if (!resumen[key]) continue;
      resumen[key].count += 1;
      resumen[key].total_cents += Number(it.total_cents || 0);
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
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

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

    const safeFrom = from === '—' ? 'sin-desde' : from;
    const safeTo = to === '—' ? 'sin-hasta' : to;
    const filename = `informe_${safeFrom}_${safeTo}.pdf`;

    doc.save(filename);
  });
  await paint();
}
