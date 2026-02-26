// Utils
export function eurFromTextToCents(s){
  // "1.258,70" -> 125870
  const cleaned = String(s || '')
    .replace(/\s/g,'')
    .replace(/\./g,'')
    .replace(',', '.')
    .replace('€','');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToEUR(cents){
  const n = (Number(cents)||0)/100;
  return n.toLocaleString('es-ES', { style:'currency', currency:'EUR' });
}

export function fnv1a(str){
  let h = 0x811c9dc5;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

export function normalizeBreakdownForUid(obj){
  const keys = ['instalacion','reparacion','desplazamiento','km','comida','material','bateria','furgon','fijo'];
  return keys.map(k => `${k}=${Number(obj?.[k]||0)}`).join('|');
}

// --- Main parse ---
// Returns: { header:{tech,date,total_pdf_cents}, parts:[{...}], calc_total_cents, errors:[] }
export function parseClosureText(text, filename='(pdf)'){
  const errors = [];
  const t = String(text || '');

  const techMatch = t.match(/Técnico:\s*(.+)/i);
  const dateMatch = t.match(/Fecha:\s*(\d{4}-\d{2}-\d{2})/i);
  const totalDayMatch = t.match(/TOTAL DEL DÍA:\s*([\d.,]+)\s*€/i);

  const tech = techMatch ? techMatch[1].trim() : '';
  const date = dateMatch ? dateMatch[1].trim() : '';
  const total_pdf_cents = totalDayMatch ? eurFromTextToCents(totalDayMatch[1]) : 0;

  if (!date) errors.push('No se detectó la Fecha en cabecera.');
  if (!tech) errors.push('No se detectó el Técnico en cabecera.');
  if (!total_pdf_cents) errors.push('No se detectó el TOTAL DEL DÍA en cabecera.');

  // Split into lines for robust scanning
  const lines = t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

  // Detect part starts like: "1. INSTALACION · Cliente 11111"
  const parts = [];
  let cur = null;

  const pushCur = ()=>{
    if (!cur) return;
    // Require minimum fields
    if (!cur.type) errors.push(`Parte sin tipo (${filename}).`);
    if (!cur.client_id) errors.push(`Parte sin cliente (${filename}).`);
    if (!cur.total_cents) errors.push(`Parte sin total (${filename}) cliente ${cur.client_id||'?'} (${filename}).`);
    parts.push(cur);
    cur = null;
  };

  for (let i=0;i<lines.length;i++){
    const line = lines[i];

    const start = line.match(/^\d+\.\s*(INSTALACION|REPARACION|MANTENIMIENTO)\s*·\s*Cliente\s*(\d+)/i);
    if (start){
      pushCur();
      cur = {
        uid: '',
        date,
        type: start[1].toUpperCase(),
        client_id: start[2],
        total_cents: 0,
        breakdown_cents: {},
        techs_in_part: [],
        obs: '',
        sources: [] // filled later
      };
      continue;
    }

    if (!cur) continue;

    const techs = line.match(/^Técnicos en parte:\s*(.+)$/i);
    if (techs){
      cur.techs_in_part = techs[1]
        .split('+')
        .map(x=>x.trim())
        .filter(Boolean);
      continue;
    }

    const totalPart = line.match(/^Total parte:\s*([\d.,]+)\s*€/i);
    if (totalPart){
      cur.total_cents = eurFromTextToCents(totalPart[1]);
      continue;
    }

    const obs = line.match(/^Obs:\s*(.*)$/i);
    if (obs){
      cur.obs = obs[1]?.trim() || '';
      continue;
    }

    // Breakdown lines, keep only known keys
    // Examples in your PDFs: "Instalación: 55,90 €"
    const bd = line.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+):\s*([\d.,]+)\s*€/);
    if (bd){
      const label = bd[1].trim().toLowerCase();
      const cents = eurFromTextToCents(bd[2]);

      // Map label -> key
      const mapKey =
        label.includes('instal') ? 'instalacion' :
        label.includes('repar') ? 'reparacion' :
        label.includes('despl') ? 'desplazamiento' :
        label.includes('kil') || label.includes('km') ? 'km' :
        label.includes('comida') ? 'comida' :
        label.includes('material') ? 'material' :
        label.includes('bater') ? 'bateria' :
        label.includes('furg') ? 'furgon' :
        label.includes('fijo') ? 'fijo' :
        null;

      if (mapKey) cur.breakdown_cents[mapKey] = cents;
      continue;
    }
  }

  pushCur();

  const calc_total_cents = parts.reduce((acc,p)=> acc + (p.total_cents||0), 0);

  // Compute UID (fingerprint)
  for (const p of parts){
    const norm = normalizeBreakdownForUid(p.breakdown_cents);
    const base = `${p.date}|${p.type}|${p.client_id}|${p.total_cents}|${norm}`;
    p.uid = fnv1a(base);
  }

  return {
    header: { tech, date, total_pdf_cents, filename },
    parts,
    calc_total_cents,
    errors
  };
}
