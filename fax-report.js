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
export function buildFaxMonthlyText(rows, { year, month }) {
  const month0 = Number(month) - 1;
  const introMonth = `${monthNameEs(month0)} ${year}`;

  const instalaciones = rows.filter(r => String(r.type || '').toUpperCase() === 'INSTALACION');

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

  parts.push(`TOTAL POR INSTALACIONES y REPARACIONES de ${introMonth} : ${euroNoSymbol(totalAll)}€ `);
  parts.push('Saludos:');
  parts.push('Bernardo González-Roca');

  return parts.join('\n');
}
