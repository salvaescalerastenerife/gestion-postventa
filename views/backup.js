import { dbAllDump, dbAllReplace } from '../db.js';
import { downloadJSON, readJSONFile } from '../backup.js';

export async function viewBackup(root, { setStatus }){
  setStatus('Backup…');

  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <h2>Backup</h2>
        <div class="muted">En Safari conviene exportar copia semanal (JSON) por seguridad.</div>
        <div class="hr"></div>

        <div class="row">
          <button class="btn primary" id="exp">Exportar JSON</button>
          <input id="impFile" type="file" accept="application/json" />
          <button class="btn danger" id="imp">Importar (reemplaza todo)</button>
        </div>

        <div class="small" style="margin-top:10px;">
          Importar reemplaza la base local completa. Úsalo solo con copias tuyas.
        </div>
      </section>
    </div>
  `;

  root.querySelector('#exp').addEventListener('click', async ()=>{
    setStatus('Generando backup…');
    const dump = await dbAllDump();
    downloadJSON(`backup_gp_${dump.exported_at.slice(0,10)}.json`, dump);
    setStatus('Backup descargado ✅', 'good');
  });

  root.querySelector('#imp').addEventListener('click', async ()=>{
    const f = root.querySelector('#impFile').files?.[0];
    if (!f){ alert('Selecciona un JSON.'); return; }
    if (!confirm('Esto reemplaza TODOS los datos locales. ¿Continuar?')) return;
    setStatus('Importando…', 'warn');
    const dump = await readJSONFile(f);
    await dbAllReplace(dump);
    setStatus('Import OK ✅', 'good');
    alert('Importación completada. Recarga la página.');
  });

  setStatus('Listo', 'good');
}
