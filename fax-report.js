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
  const h = it?.header || {};
  const d = it?.datos || {};
  const t = it?.tarifas || {};

  const clientName = titleCaseLoose(h.client_name || h.cliente || '');
  const clientId = h.idCliente || it.client_id || '';
  const dateTxt = shortDate(it.date);

  const horasInst = Number(d.horas_inst || 0);
  const horasDespl = Number(d.horas_despl || 0);
  const kms = Number(d.kms || 0);
  const comida = Number(d.almuerzo || 0);
  const cena = Number(d.cena || 0);
  const material = Number(d.material || 0);
  const furgon = d.furgon ? Number(t.FURGON || 80) : 0;

  const pInst = Number(t.P_INST || 27.95);
  const pDespl = Number(t.P_DESPL || 19.28);
  const pKm = Number(t.P_KM || 0.31);

  const nTechs =
    [h.tecnico1, h.tecnico2].filter(Boolean).length || 2;

  const totalInst = horasInst * pInst * nTechs;
  const totalDespl = horasDespl * pDespl * nTechs;
  const totalKm = kms * pKm;
  const total = Number(it.total_cents || 0);

  const out = [];
  out.push(`Instalación ${clientName} Int: ${clientId}  ${dateTxt}`);

  if (horasInst > 0) {
    out.push(`Horas de instalación: ${horasInst}x${pInst} x${nTechs} =${euroNoSymbol(Math.round(totalInst * 100))}€`);
  }
  if (horasDespl > 0) {
    out.push(`Horas desplazamiento ${horasDespl}x${pDespl} x${nTechs}= ${euroNoSymbol(Math.round(totalDespl * 100))}€`);
  }
  if (kms > 0) {
    out.push(`Km:${kms}x ${String(pKm).replace('.', ',')}€: ${euroNoSymbol(Math.round(totalKm * 100))}€`);
  }
  if (comida > 0) {
    out.push(`Comida: ${euroNoSymbol(Math.round(comida * 100))}€`);
  }
  if (cena > 0) {
    out.push(`Cena: ${euroNoSymbol(Math.round(cena * 100))}€`);
  }
  if (material > 0) {
    out.push(`Consumibles: ${euroNoSymbol(Math.round(material * 100))}`);
  }
  if (furgon > 0) {
    out.push(`Furgon: ${euroNoSymbol(Math.round(furgon * 100))}€`);
  }

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
  parts.push('MENSAJE VIA FAX');
  parts.push('');
  parts.push('196');
  parts.push(`DE: BERNARDO GONZALEZ-ROCA  FECHA:${new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' })}`);
  parts.push('EMPRESA: GONZALEZ-ROCA Suministros Ortopédicos - Delegación Stannah-INCISA Canarias ');
  parts.push('');
  parts.push('PARA: Jose Manuel Duran y Roser');
  parts.push('EMPRESA: Stannah-INCISA');
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
