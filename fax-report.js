import { centsToEUR } from './parser.js';

function euroNoSymbol(cents) {
  const n = (Number(cents) || 0) / 100;
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function shortDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-');
  if (!y || !m || !d) return String(ymd);
  return `${Number(d)}/${Number(m)}/${String(y).slice(-2)}`;
}

function monthNameEs(monthIndex0) {
  return [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ][monthIndex0] || '';
}

function titleCaseLoose(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function buildInstalacionBlock(it) {
  const fm = it?.fax_meta || {};

  const clientName = String(it?.client_name || '').trim();
  const clientId = it?.client_id || '';
  const dateTxt = shortDate(it?.date);

  const horasInst = Number(fm.horas_base_h || 0);
  const horasInstRate = Number(fm.horas_base_rate || 27.95);
  const horasInstMult = Number(fm.horas_base_mult || 2);
  const totalInst = Number(fm.horas_base_total_cents || 0);

  const horasDespl = Number(fm.horas_despl_h || 0);
  const horasDesplRate = Number(fm.horas_despl_rate || 19.28);
  const horasDesplMult = Number(fm.horas_despl_mult || 2);
  const totalDespl = Number(fm.horas_despl_total_cents || 0);

  const kms = Number(fm.km_units || 0);
  const kmRate = Number(fm.km_rate || 0.31);
  const totalKm = Number(fm.km_total_cents || 0);

  const almuerzo = Number(fm.almuerzo_cents || 0);
  const cena = Number(fm.cena_cents || 0);
  const comida = Number(fm.comida_cents || 0);
  const material = Number(fm.material_cents || 0);

  const total = Number(it?.total_cents || 0);

  const out = [];
  out.push(`[[TITLE]]Instalación ${clientName} Int: ${clientId}  ${dateTxt}`);

  if (horasInst > 0) {
    out.push(`Horas de instalación: ${String(horasInst).replace('.', ',')}x${horasInstRate} x${horasInstMult} =${euroNoSymbol(totalInst)}€`);
  }
  if (horasDespl > 0) {
    out.push(`Horas desplazamiento ${String(horasDespl).replace('.', ',')}x${horasDesplRate} x${horasDesplMult}= ${euroNoSymbol(totalDespl)}€`);
  }
  if (kms > 0) {
    out.push(`Km:${String(kms).replace('.', ',')}x ${String(kmRate).replace('.', ',')}€: ${euroNoSymbol(totalKm)}€`);
  }
  if (almuerzo > 0 || comida > 0) {
    out.push(`Comida: ${euroNoSymbol(almuerzo || comida)}€`);
  }
  if (cena > 0) {
    out.push(`Cena: ${euroNoSymbol(cena)}€`);
  }
  if (material > 0) {
    out.push(`Consumibles: ${euroNoSymbol(material)}`);
  }

  out.push(`Furgon: 80€`);
  out.push(`Total:${euroNoSymbol(total)}€`);
  out.push('');
  return out.join('\n');
}
function buildReparacionBlock(it) {
  const fm = it?.fax_meta || {};

  const clientName = String(it?.client_name || '').trim();
  const clientId = it?.client_id || '';
  const dateTxt = shortDate(it?.date);

  const horasBase = Number(fm.horas_base_h || 0);
  const horasBaseRate = Number(fm.horas_base_rate || 32.14);
  const horasBaseMult = Number(fm.horas_base_mult || 1);
  const totalBase = Number(fm.horas_base_total_cents || 0);

  const horasDespl = Number(fm.horas_despl_h || 0);
  const horasDesplRate = Number(fm.horas_despl_rate || 19.28);
  const horasDesplMult = Number(fm.horas_despl_mult || 1);
  const totalDespl = Number(fm.horas_despl_total_cents || 0);

  const kms = Number(fm.km_units || 0);
  const kmRate = Number(fm.km_rate || 0.31);
  const totalKm = Number(fm.km_total_cents || 0);

  const comida = Number(fm.comida_cents || 0);
  const material = Number(fm.material_cents || 0);
  const bateria = Number(fm.bateria_cents || 0);
  const parking = Number(fm.parking_cents || 0);
  const gasolina = Number(fm.gasolina_cents || 0);
  const alquiler = Number(fm.alquiler_coche_cents || 0);

  const total = Number(it?.total_cents || 0);

  const out = [];
  out.push(`[[TITLE]]Reparacion ${clientName} Int: ${clientId}  ${dateTxt}`);

  if (horasBase > 0) {
    if (horasBaseMult > 1) {
      out.push(`Horas de instalación:  ${String(horasBase).replace('.', ',')}h x ${horasBaseRate}€x${horasBaseMult}=${euroNoSymbol(totalBase)}€`);
    } else {
      out.push(`Horas de instalación:  ${String(horasBase).replace('.', ',')}h x ${horasBaseRate}€=${euroNoSymbol(totalBase)}€`);
    }
  }

  if (horasDespl > 0) {
    if (horasDesplMult > 1) {
      out.push(`Horas desplazamiento: ${String(horasDespl).replace('.', ',')}h x${horasDesplRate}€x${horasDesplMult}=${euroNoSymbol(totalDespl)}€`);
    } else {
      out.push(`Horas desplazamiento: ${String(horasDespl).replace('.', ',')}h x${horasDesplRate}€=${euroNoSymbol(totalDespl)}€`);
    }
  }

  if (kms > 0) {
    out.push(`Km:${String(kms).replace('.', ',')}x${String(kmRate).replace('.', '.')}=${euroNoSymbol(totalKm)}€`);
  }

  if (comida > 0) {
    out.push(`Comida: ${euroNoSymbol(comida)}€`);
  }
  if (material > 0) {
    out.push(`Material: ${euroNoSymbol(material)}€`);
  }
  if (bateria > 0) {
    out.push(`Baterias: ${euroNoSymbol(bateria)}€`);
  }
  if (parking > 0) {
    out.push(`Parking: ${euroNoSymbol(parking)}€`);
  }
  if (gasolina > 0) {
    out.push(`Gasolina:${euroNoSymbol(gasolina)}€`);
  }
  if (alquiler > 0) {
    out.push(`Coche alquiler ${euroNoSymbol(alquiler)}€`);
  }

  out.push(`Total: ${euroNoSymbol(total)}€`);
  out.push('');
  return out.join('\n');
}

function buildMantenimientoBlock(it) {
  const fm = it?.fax_meta || {};

  const clientName = String(it?.client_name || '').trim();
  const clientId = it?.client_id || '';
  const dateTxt = shortDate(it?.date);

  const mantenimiento = Number(fm.mantenimiento_fijo_cents || fm.horas_base_total_cents || 0);
  const pilasUnits = Number(fm.pilas_units || 0);
  const pilasTotal = Number(fm.pilas_total_cents || 0);
  const bateria = Number(fm.bateria_cents || 0);
  const comida = Number(fm.comida_cents || 0);
  const parking = Number(fm.parking_cents || 0);
  const alquiler = Number(fm.alquiler_coche_cents || 0);
  const total = Number(it?.total_cents || 0);

  const out = [];
  out.push(`[[TITLE]]Reparacion ${clientName} Int: ${clientId}  ${dateTxt}`);

  if (mantenimiento > 0) {
    out.push(`Mantenimiento: ${euroNoSymbol(mantenimiento)}€`);
    out.push('');
  }
  if (pilasUnits > 0) {
    out.push(`Pilas: ${pilasUnits}€`);
    out.push('');
  }
  if (comida > 0) {
    out.push(`Comida: ${euroNoSymbol(comida)}€`);
    out.push('');
  }
  if (parking > 0) {
    out.push(`Parking: ${euroNoSymbol(parking)}€`);
    out.push('');
  }
  if (alquiler > 0) {
    out.push(`Coche alquiler ${euroNoSymbol(alquiler)}€`);
    out.push('');
  }
  if (bateria > 0) {
    out.push(`Baterias: ${euroNoSymbol(bateria)}€`);
  }

  out.push(`Total: ${euroNoSymbol(total)}€`);
  out.push('');
  return out.join('\n');
}
function hasUsefulDetail(it) {
  const fm = it?.fax_meta || {};
  return (
    Number(fm.horas_base_total_cents || 0) > 0 ||
    Number(fm.horas_despl_total_cents || 0) > 0 ||
    Number(fm.km_total_cents || 0) > 0 ||
    Number(fm.almuerzo_cents || 0) > 0 ||
    Number(fm.comida_cents || 0) > 0 ||
    Number(fm.cena_cents || 0) > 0 ||
    Number(fm.material_cents || 0) > 0 ||
    Number(fm.bateria_cents || 0) > 0 ||
    Number(fm.mantenimiento_fijo_cents || 0) > 0
  );
}

function removeFaxDuplicateSummaries(rows) {
  const best = new Map();

  for (const it of rows) {
    const key = [
      it.date || '',
      it.type || '',
      it.client_id || '',
      Number(it.total_cents || 0)
    ].join('|');

    const prev = best.get(key);

    if (!prev) {
      best.set(key, it);
      continue;
    }

    if (!hasUsefulDetail(prev) && hasUsefulDetail(it)) {
      best.set(key, it);
    }
  }

  return Array.from(best.values());
}
export function buildFaxMonthlyText(rows, { year, month }) {
  const month0 = Number(month) - 1;
  const introMonth = `${monthNameEs(month0)} ${year}`;

  const instalaciones = rows.filter(r => String(r.type || '').toUpperCase() === 'INSTALACION');
  const reparaciones = rows.filter(r => String(r.type || '').toUpperCase() === 'REPARACION');
  const mantenimientos = rows.filter(r => String(r.type || '').toUpperCase() === 'MANTENIMIENTO');

  const totalAll = rows.reduce((acc, r) => acc + Number(r.total_cents || 0), 0);

  const parts = [];
  parts.push(`[[BOLD]]DE: BERNARDO GONZALEZ-ROCA  FECHA:${new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })}`);
  parts.push('[[BOLD]]EMPRESA: GONZALEZ-ROCA Suministros Ortopédicos - Delegación Stannah-INCISA Canarias ');
  parts.push('');
  parts.push('[[BOLD]]PARA: Jose Manuel Duran y Roser');
  parts.push('[[BOLD]]EMPRESA: Stannah-INCISA');
  parts.push('Nº DE PÁGINAS (incluyendo esta): ');
  parts.push('Estimados Jose Manuel y Roser:');
  parts.push('');
  parts.push(`Les paso a continuación el detalle del coste de las instalaciones y de las reparaciones y mantenimientos realizadas en ${introMonth}. `);

  instalaciones.forEach(it => {
    parts.push(buildInstalacionBlock(it));
  });

  reparaciones.forEach(it => {
    parts.push(buildReparacionBlock(it));
  });

  mantenimientos.forEach(it => {
    parts.push(buildMantenimientoBlock(it));
  });

  parts.push(`TOTAL POR INSTALACIONES y REPARACIONES de ${introMonth} : ${euroNoSymbol(totalAll)}€ `);
  parts.push('Saludos:');
  parts.push('Bernardo González-Roca');

  return parts.join('\n');
}
