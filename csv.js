import { centsToEUR } from './parser.js';

function esc(s){
  const v = String(s ?? '');
  if (/[,"\n]/.test(v)) return `"${v.replace(/"/g,'""')}"`;
  return v;
}

export function interventionsToCSV(rows){
  const headers = [
    'date','type','client_id','total',
    'instalacion','reparacion','desplazamiento','km','comida','material','bateria','furgon','fijo',
    'techs_in_part','sources_count','uid'
  ];

  const lines = [headers.join(',')];

  for (const r of rows){
    const b = r.breakdown_cents || {};
    const line = [
      r.date,
      r.type,
      r.client_id,
      centsToEUR(r.total_cents),
      centsToEUR(b.instalacion||0),
      centsToEUR(b.reparacion||0),
      centsToEUR(b.desplazamiento||0),
      centsToEUR(b.km||0),
      centsToEUR(b.comida||0),
      centsToEUR(b.material||0),
      centsToEUR(b.bateria||0),
      centsToEUR(b.furgon||0),
      centsToEUR(b.fijo||0),
      (r.techs_in_part||[]).join(' + '),
      (r.sources||[]).length,
      r.uid
    ].map(esc);

    lines.push(line.join(','));
  }

  return lines.join('\n');
}

export function downloadTextFile(filename, text, mime='text/plain'){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
