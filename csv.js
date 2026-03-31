import { centsToEUR } from './parser.js';

function esc(s){
  const v = String(s ?? '');
  if (/[,"\n]/.test(v)) return `"${v.replace(/"/g,'""')}"`;
  return v;
}

export function interventionsToCSV(rows){
  const headers = [
    'fecha',
    'tipo_intervencion',
    'cod_cliente',
    'importe',
    'tecnicos'
  ];

  const lines = [headers.join(';')];

  for (const r of rows){
    const techs = Array.isArray(r.techs_in_part)
      ? r.techs_in_part.map(t => String(t || '').trim()).filter(Boolean).join(' + ')
      : '';

    const line = [
      r.date || '',
      r.type || '',
      r.client_id || '',
(Number(r.total_cents || 0) / 100).toFixed(2).replace('.', ','),
      techs
    ].map(esc);

    lines.push(line.join(';'));
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
