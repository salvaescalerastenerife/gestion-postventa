export function viewReports() {
  return `
    <div class="view">
      <div class="card">
        <h2>Informes de facturación</h2>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
          <input type="date" id="rDesde">
          <input type="date" id="rHasta">

          <select id="rTipo">
            <option value="">Todas</option>
            <option value="instalacion">Instalación</option>
            <option value="reparacion">Reparación</option>
            <option value="mantenimiento">Mantenimiento</option>
          </select>

          <button id="btnGenerar">Generar</button>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Resumen</h3>

        <div style="display:grid; gap:8px; margin-top:10px;">
          <div>Total: <strong id="kTotal">0 €</strong></div>
          <div>Instalación: <strong id="kInst">0 €</strong></div>
          <div>Reparación: <strong id="kRep">0 €</strong></div>
          <div>Mantenimiento: <strong id="kMant">0 €</strong></div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Detalle</h3>

        <table style="width:100%; margin-top:10px;">
          <thead>
            <tr>
              <th style="text-align:left;">Tipo</th>
              <th style="text-align:center;">Intervenciones</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody id="rTabla"></tbody>
        </table>
      </div>
    </div>
  `;
}
