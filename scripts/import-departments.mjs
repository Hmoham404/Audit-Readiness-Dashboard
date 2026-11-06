import fs from 'node:fs/promises';
import { readSheet } from 'read-excel-file/node';
import { parseAuditRows } from '../src/excel-parser.ts';

// Explicit names avoid confusing the revised GMP report with a SMETA report.
const sources = {
  GMP: {
    original: "MYCTN-FM-QM-007 V0 Rapport de Non-Conformité et d'Action Corrective-audit 19-10-2026 GMP.xlsx",
    revised: "MYCTN-FM-QM-007 V0 Rapport de Non-Conformité et d'Action Corrective-audit 19-10-2026.xlsx",
  },
  SMETA: {
    original: "MYCTN-FM-QM-007 V0 Rapport de Non-Conformité et d'Action Corrective-audit 08-09-10-2026.xlsx",
    revised: "MYCTN-FM-QM-007 V0 Rapport de Non-Conformité et d'Action Corrective-audit 08-09-10-2026 (1).xlsx",
  },
};
const updates = [];
for (const [audit, files] of Object.entries(sources)) {
  const parse = async file => parseAuditRows(await readSheet(file, { sheet: 'Registre NC' }), audit, file, 'Registre NC', '');
  const original = await parse(files.original);
  const revised = await parse(files.revised);
  if (original.points.length !== revised.points.length) throw new Error(`${audit} : nombre de points différent`);
  for (const point of revised.points) {
    const before = original.points.find(p => p.num === point.num);
    if (!before || before.details.facts !== point.details.facts || !point.department) {
      throw new Error(`${audit} NC ${point.num} : correspondance ou département invalide`);
    }
    updates.push({ audit, num: point.num, previousDepartment: before.department, department: point.department, file: files.revised });
  }
}
await fs.writeFile('src/corrective-departments.json', JSON.stringify(updates, null, 2) + '\n');
console.log(`${updates.length} départements vérifiés ; ${updates.filter(p => p.department !== p.previousDepartment).length} corrections. Aucun statut, responsable ou délai réimporté.`);
