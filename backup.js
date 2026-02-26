import { downloadTextFile } from './csv.js';

export function downloadJSON(filename, obj){
  downloadTextFile(filename, JSON.stringify(obj, null, 2), 'application/json');
}

export async function readJSONFile(file){
  const txt = await file.text();
  return JSON.parse(txt);
}
