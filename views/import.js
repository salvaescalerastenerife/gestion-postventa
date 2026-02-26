import { extractPdfText } from '../pdf-import.js';
import { parseClosureText } from '../parser.js';
import { dbInterventionGet, dbInterventionsPutMany, dbImportsPutMany, dbMetaSet } from '../db.js';

export async function viewImport(root, { state, setStatus }){
  root.innerHTML = `
    <div class="grid">
      <section class="card">
        <div class="spread">
          <div>
            <h2>Importar cierres (PDF)</h2>
            <div class="muted">Arrastra PDFs aquí o selecciónalos. Se deduplican intervenciones automáticamente.</div>
          </div>
          <div class="row">
            <input id="filePick" type="file" accept="application/pdf" multiple />
            <button class="btn primary" id="btnParse" disabled>Procesar</button>
            <button class="btn" id="btnConfirm" disabled>Confirmar importación</button>
          </div>
        </div>
        <div class="hr"></div>
        <div id="drop" class="kpi" style="text-align:center; padding:18px; border-style:dashed;">
          Suelta aquí los PDFs
        </div>
        <div id="msg" class="small" style="margin-top:10px;"></div>
      </section>

      <section class="card">
        <h2>Pre-import</h2>
        <table class="table" id="tbl">
          <thead>
            <tr>
              <th>Archivo</th><th>Fecha</th><th>Técnico</th><th>Partes</th><th>Total PDF</th><th>Total calc</th><th>Nuevas</th><th>Dupes</th><th>Estado</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </section>
    </div>
  `;

  const filePick = root.querySelector('#filePick');
  const btnParse = root.querySelector('#btnParse');
  const btnConfirm = root.querySelector('#btnConfirm');
  const drop = root.querySelector('#drop');
  const msg = root.querySelector('#msg');
  const tbody = root.querySelector('#tbl tbody');

  let files = [];

  function setFiles(list){
    files = Array.from(list || []);
    btnParse.disabled = files.length === 0;
    btnConfirm.disabled = true;
    state.preImport = [];
    tbody.innerHTML = '';
    msg.textContent = files.length ? `${files.length} PDF(s) listo(s) para procesar.` : '';
  }

  drop.addEventListener('dragover', (e)=>{ e.preventDefault(); drop.style.borderColor='rgba(42,168,255,.6)'; });
  drop.addEventListener('dragleave', ()=>{ drop.style.borderColor='rgba(255,255,255,.12)'; });
  drop.addEventListener('drop', (e)=>{
    e.preventDefault();
    drop.style.borderColor='rgba(255,255,255,.12)';
    setFiles(e.dataTransfer.files);
  });

  filePick.addEventListener('change', ()=> setFiles(filePick.files));

  btnParse.addEventListener('click', async ()=>{
    setStatus('Procesando PDFs…');
    btnParse.disabled = true;
    btnConfirm.disabled = true;
    tbody.innerHTML = '';
    state.preImport = [];

    for (const f of files){
      try{
        const text = await extractPdfText(f);
        const parsed = parseClosureText(text, f.name);

        // Determine how many are new vs dupes (by uid)
        let newCount = 0, dupes = 0;
        for (const p of parsed.parts){
          const existing = await dbInterventionGet(p.uid);
          if (existing) dupes++; else newCount++;
        }

        const ok = parsed.errors.length === 0 && Math.abs((parsed.header.total_pdf_cents||0) - (parsed.calc_total_cents||0)) <= 1;
        const hasErr = parsed.errors.length > 0;

        state.preImport.push({
          file: f,
          parsed,
          newCount,
          dupes,
          ok,
          hasErr
        });

      }catch(e){
        state.preImport.push({
          file: f,
          parsed: {
            header: { tech:'', date:'', total_pdf_cents:0, filename:f.name },
            parts: [],
            calc_total_cents: 0,
            errors: ['Error leyendo PDF (PDF.js o archivo corrupto).']
          },
          newCount: 0,
          dupes: 0,
          ok: false,
          hasErr: true
        });
      }
    }

    // Render table
    for (const row of state.preImport){
      const { parsed, newCount, dupes } = row;
      const ok = row.ok;
      const st = row.hasErr ? 'bad' : ok ? 'good' : 'warn';
      const label = row.hasErr ? 'ERROR' : ok ? 'OK' : 'MISMATCH';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="small">${parsed.header.filename}</td>
        <td>${parsed.header.date||'—'}</td>
        <td>${parsed.header.tech||'—'}</td>
        <td>${parsed.parts.length}</td>
        <td>${(parsed.header.total_pdf_cents||0)/100}€</td>
        <td>${(parsed.calc_total_cents||0)/100}€</td>
        <td>${newCount}</td>
        <td>${dupes}</td>
        <td><span class="badge ${st}">${label}</span></td>
      `;
      tbody.appendChild(tr);

      if (parsed.errors.length){
        const tr2 = document.createElement('tr');
        tr2.innerHTML = `<td colspan="9" class="small" style="color:rgba(239,68,68,.9)">${parsed.errors.join(' | ')}</td>`;
        tbody.appendChild(tr2);
      }
    }

    const hasFatal = state.preImport.some(x=>x.hasErr);
    btnConfirm.disabled = hasFatal || state.preImport.length === 0;
    btnParse.disabled = false;

    setStatus(hasFatal ? 'Hay PDFs con error' : 'Pre-import listo', hasFatal ? 'warn' : 'good');
  });

  btnConfirm.addEventListener('click', async ()=>{
    setStatus('Guardando…');
    btnConfirm.disabled = true;

    const now = new Date().toISOString();
    const imports = [];
    const interventionsToUpsert = [];

    let totalNew = 0, totalDupes = 0;

    for (const row of state.preImport){
      const { parsed, newCount, dupes } = row;

      // Create import row
      const import_id = crypto.randomUUID();
      imports.push({
        import_id,
        date_detected: parsed.header.date || '',
        tech_detected: parsed.header.tech || '',
        filename: parsed.header.filename || '',
        pdf_total_cents: parsed.header.total_pdf_cents || 0,
        calc_total_cents: parsed.calc_total_cents || 0,
        parts_detected: parsed.parts.length || 0,
        new_interventions: newCount,
        dupes,
        parse_errors: parsed.errors || [],
        imported_at: now
      });

      totalNew += newCount;
      totalDupes += dupes;

      // Upsert interventions with sources merge
      for (const p of parsed.parts){
        const existing = await dbInterventionGet(p.uid);
        const source = {
          import_id,
          filename: parsed.header.filename || '',
          tech_closure: parsed.header.tech || '',
          imported_at: now
        };

        if (!existing){
          interventionsToUpsert.push({
            uid: p.uid,
            date: p.date,
            type: p.type,
            client_id: p.client_id,
            total_cents: p.total_cents,
            breakdown_cents: p.breakdown_cents || {},
            techs_in_part: p.techs_in_part || [],
            obs: p.obs || '',
            sources: [source],
            created_at: now
          });
        } else {
          const sources = Array.isArray(existing.sources) ? existing.sources.slice() : [];
          const already = sources.some(s => s.import_id === import_id);
          if (!already) sources.push(source);

          interventionsToUpsert.push({
            ...existing,
            sources
          });
        }
      }
    }

    await dbImportsPutMany(imports);
    await dbInterventionsPutMany(interventionsToUpsert);

    // pick last selected date as latest imported date
    const lastDate = imports.map(x=>x.date_detected).filter(Boolean).sort().pop();
    if (lastDate) {
      state.selectedDate = lastDate;
      await dbMetaSet('last_selected_date', lastDate);
    }

    setStatus(`Importado ✅ Nuevas: ${totalNew} · Dupes evitados: ${totalDupes}`, 'good');
    msg.textContent = `Importación OK. Nuevas: ${totalNew}. Duplicadas evitadas: ${totalDupes}.`;
    btnConfirm.disabled = true;
  });
}
