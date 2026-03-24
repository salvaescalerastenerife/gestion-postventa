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
  btnPdf?.addEventListener('click', () => {
    const content = `
      <html>
        <head>
          <title>Informe</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { margin-bottom: 10px; }
            p { margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>Informe de facturación</h1>
          <p>Total: ${kTotal.textContent}</p>

          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Intervenciones</th>
                <th>Total</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              ${rows.innerHTML}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        setTimeout(() => {
          iframe.remove();
        }, 1000);
      }, 300);
    };
  });
  await paint();
}
