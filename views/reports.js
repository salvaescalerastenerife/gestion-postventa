export async function viewReports(root, { setStatus }) {
  setStatus('Cargando informes…');

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <div class="spread">
          <div>
            <h2>Informes</h2>
            <div class="muted">Consulta totales facturados por intervención.</div>
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
          <div class="small">Solo INSTALACION</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Reparación</div>
          <div class="value" id="kRep">0,00 €</div>
          <div class="small">Solo REPARACION</div>
        </div>
      </section>

      <section class="card span4">
        <div class="kpi">
          <div class="label">Mantenimiento</div>
          <div class="value" id="kMant">0,00 €</div>
          <div class="small">Solo MANTENIMIENTO</div>
        </div>
      </section>

      <section class="card">
        <h2>Filtros</h2>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px;">
          <div>
            <label class="small">Desde</label>
            <input class="input" type="date" id="rDesde">
          </div>
          <div>
            <label class="small">Hasta</label>
            <input class="input" type="date" id="rHasta">
          </div>
          <div>
            <label class="small">Tipo</label>
            <select class="input" id="rTipo">
              <option value="">Todas</option>
              <option value="INSTALACION">Instalación</option>
              <option value="REPARACION">Reparación</option>
              <option value="MANTENIMIENTO">Mantenimiento</option>
            </select>
          </div>
          <div style="display:flex; align-items:end;">
            <button class="btn-primary" id="btnGenerar" type="button">Generar informe</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Detalle</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Intervenciones</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody id="rTabla">
            <tr><td colspan="3" class="small">Pulsa “Generar informe”.</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  `;

  setStatus('Listo', 'good');
}
