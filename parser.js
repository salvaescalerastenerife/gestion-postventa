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

  // ❌ Ignorar partes basura (solo furgón + total)
  const hasOnlyFurgon =
    Object.keys(cur.breakdown_cents || {}).length <= 1 &&
    cur.breakdown_cents?.furgon;

  const hasNoWork =
    !cur.fax_meta?.horas_base_total_cents &&
    !cur.fax_meta?.horas_despl_total_cents &&
    !cur.fax_meta?.km_total_cents;

  if (hasOnlyFurgon || hasNoWork) {
    cur = null;
    return;
  }
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
      const startLine = line;
      cur = {
        uid: '',
        date,
        type: start[1].toUpperCase(),
        client_id: start[2],
        client_name: '',
        total_cents: 0,
        breakdown_cents: {},
        fax_meta: {
          line_title: startLine,
          horas_base_label: '',
          horas_base_h: null,
          horas_base_rate: null,
          horas_base_mult: null,
          horas_base_total_cents: 0,
          horas_despl_h: null,
          horas_despl_rate: null,
          horas_despl_mult: null,
          horas_despl_total_cents: 0,
          km_units: null,
          km_rate: null,
          km_total_cents: 0,
          almuerzo_cents: 0,
          cena_cents: 0,
          comida_cents: 0,
          material_cents: 0,
          bateria_cents: 0,
          pilas_units: null,
          pilas_unit_cents: 0,
          pilas_total_cents: 0,
          furgon_cents: 0,
          mantenimiento_fijo_cents: 0,
          parking_cents: 0,
          gasolina_cents: 0,
          alquiler_coche_cents: 0
        },
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
    const nameMatch = line.match(/^Nombre cliente:\s*(.+)$/i);
if (nameMatch){
  cur.client_name = nameMatch[1].trim();
  continue;
}
const horasBase = line.match(/^(Instalación|Reparación|Mantenimiento(?:\s*\(fijo\))?):\s*([\d.,]+)(?:\s*h)?(?:\s*x(\d+))?\s*=\s*([\d.,]+)\s*€/i);
if (horasBase){
  const totalCents = eurFromTextToCents(horasBase[4]);

  cur.fax_meta.horas_base_label = horasBase[1].trim();
  cur.fax_meta.horas_base_h = eurFromTextToCents(horasBase[2]) / 100;
  cur.fax_meta.horas_base_mult = horasBase[3] ? Number(horasBase[3]) : null;
  cur.fax_meta.horas_base_total_cents = totalCents;

  const labelLc = horasBase[1].toLowerCase();
  if (labelLc.includes('mantenimiento')) {
    cur.fax_meta.horas_base_rate = null;
    cur.breakdown_cents.fijo = totalCents;
  } else if (labelLc.includes('instal')) {
    cur.fax_meta.horas_base_rate = 27.95;
    cur.breakdown_cents.instalacion = totalCents;
  } else if (labelLc.includes('repar')) {
    cur.fax_meta.horas_base_rate = 32.14;
    cur.breakdown_cents.reparacion = totalCents;
  }

  continue;
}
const horasDespl = line.match(/^Desplazamiento:\s*([\d.,]+)\s*h(?:\s*x(\d+))?\s*=\s*([\d.,]+)\s*€/i);
if (horasDespl){
  const totalCents = eurFromTextToCents(horasDespl[3]);

  cur.fax_meta.horas_despl_h = eurFromTextToCents(horasDespl[1]) / 100;
  cur.fax_meta.horas_despl_mult = horasDespl[2] ? Number(horasDespl[2]) : null;
  cur.fax_meta.horas_despl_total_cents = totalCents;
  cur.fax_meta.horas_despl_rate = 19.28;

  cur.breakdown_cents.desplazamiento = totalCents;

  continue;
}
const kmsLine = line.match(/^Kilómetros:\s*([\d.,]+)\s*=\s*([\d.,]+)\s*€/i);
if (kmsLine){
  const totalCents = eurFromTextToCents(kmsLine[2]);

  cur.fax_meta.km_units = eurFromTextToCents(kmsLine[1]) / 100;
  cur.fax_meta.km_rate = 0.31;
  cur.fax_meta.km_total_cents = totalCents;

  cur.breakdown_cents.km = totalCents;

  continue;
}
const almuerzoLine = line.match(/^Almuerzo:\s*([\d.,]+)\s*€/i);
if (almuerzoLine){
  const cents = eurFromTextToCents(almuerzoLine[1]);
  cur.fax_meta.almuerzo_cents = cents;
  cur.breakdown_cents.comida = (cur.breakdown_cents.comida || 0) + cents;
  continue;
}

const cenaLine = line.match(/^Cena:\s*([\d.,]+)\s*€/i);
if (cenaLine){
  const cents = eurFromTextToCents(cenaLine[1]);
  cur.fax_meta.cena_cents = cents;
  cur.breakdown_cents.comida = (cur.breakdown_cents.comida || 0) + cents;
  continue;
}

const comidaLine = line.match(/^Comida:\s*([\d.,]+)\s*€/i);
if (comidaLine){
  const cents = eurFromTextToCents(comidaLine[1]);
  cur.fax_meta.comida_cents = cents;
  cur.breakdown_cents.comida = (cur.breakdown_cents.comida || 0) + cents;
  continue;
}

const materialLine = line.match(/^Material:\s*([\d.,]+)\s*€/i);
if (materialLine){
  const cents = eurFromTextToCents(materialLine[1]);
  cur.fax_meta.material_cents = cents;
  cur.breakdown_cents.material = cents;
  continue;
}
const bateriaLine = line.match(/^Batería:\s*([\d.,]+)\s*€/i);
if (bateriaLine){
  const cents = eurFromTextToCents(bateriaLine[1]);
  cur.fax_meta.bateria_cents = cents;
  cur.breakdown_cents.bateria = cents;
  continue;
}

    const pilasLine = line.match(/^Pilas:\s*(\d+)\s*x\s*([\d.,]+)\s*€\s*=\s*([\d.,]+)\s*€/i);
    if (pilasLine){
      cur.fax_meta.pilas_units = Number(pilasLine[1]);
      cur.fax_meta.pilas_unit_cents = eurFromTextToCents(pilasLine[2]);
      cur.fax_meta.pilas_total_cents = eurFromTextToCents(pilasLine[3]);
      continue;
    }

const furgonLine = line.match(/^Furgón:\s*([\d.,]+)\s*€/i);
if (furgonLine){
  const cents = eurFromTextToCents(furgonLine[1]);
  cur.fax_meta.furgon_cents = cents;
  cur.breakdown_cents.furgon = cents;
  continue;
}

    const mantenimientoLine = line.match(/^Mantenimiento(?:\s*\(fijo\))?:\s*([\d.,]+)\s*€/i);
    if (mantenimientoLine){
      cur.fax_meta.mantenimiento_fijo_cents = eurFromTextToCents(mantenimientoLine[1]);
      continue;
    }

    const parkingLine = line.match(/^Parking:\s*([\d.,]+)\s*€/i);
    if (parkingLine){
      cur.fax_meta.parking_cents = eurFromTextToCents(parkingLine[1]);
      continue;
    }

    const gasolinaLine = line.match(/^Gasolina:\s*([\d.,]+)\s*€/i);
    if (gasolinaLine){
      cur.fax_meta.gasolina_cents = eurFromTextToCents(gasolinaLine[1]);
      continue;
    }

    const alquilerLine = line.match(/^(?:Coche alquiler|Alquiler coche):\s*([\d.,]+)\s*€/i);
    if (alquilerLine){
      cur.fax_meta.alquiler_coche_cents = eurFromTextToCents(alquilerLine[1]);
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
const base = `${p.date}|${p.type}|${p.client_id}|${p.total_cents}`;
p.uid = fnv1a(base);

  return {
    header: { tech, date, total_pdf_cents, filename },
    parts,
    calc_total_cents,
    errors
  };
}
