import fs from 'node:fs/promises';
import path from 'node:path';
import { readSheet } from 'read-excel-file/node';
// Node 24 strips the parser's types; its data import is type-only.
import { parseAuditRows } from '../src/excel-parser.ts';

const files = (await fs.readdir('.')).filter(name => name.startsWith('MYCTN') && name.endsWith('.xlsx'));
const imports = {};
for (const audit of ['GMP', 'SMETA']) {
  const file = files.find(name => audit === 'GMP' ? name.includes('GMP') : !name.includes('GMP'));
  if (!file) throw new Error(`Classeur ${audit} absent`);
  imports[audit] = parseAuditRows(await readSheet(path.resolve(file), { sheet: 'Registre NC' }), audit, file, 'Registre NC', '2026-11-30');
}
await fs.writeFile('src/corrective-seed.json', JSON.stringify(imports, null, 2) + '\n');
for (const [audit, result] of Object.entries(imports)) console.log(`${audit}: ${result.points.length} points, ${result.points.filter(p=>p.status===1).length} terminés, ${result.warnings.length} avertissement(s)`);
