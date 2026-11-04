import type { AuditKind, Point } from './data';

type Cell = unknown;
export type ImportResult = { points: Point[]; warnings: string[]; sheet: string; file: string };
const value = (cell: Cell | undefined) => cell == null ? '' : String(cell).trim();
const normalize = (cell: Cell | undefined) => value(cell).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');

export function excelDate(cell: Cell | undefined): string {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell.toISOString().slice(0, 10);
  const raw = value(cell);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const french = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  const date = iso ? raw : french ? `${french[3]}-${french[2].padStart(2, '0')}-${french[1].padStart(2, '0')}` : '';
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
}

/** Parse the detail sheet, never the summary formulas. Empty status means In Progress. */
export function parseAuditRows(rows: Cell[][], audit: AuditKind, file: string, sheet: string, fallbackDue: string): ImportResult {
  const headerIndex = rows.findIndex(row => row.some(c => /description des faits non conformes|checklist|point.*audit/.test(normalize(c))));
  if (headerIndex < 0) throw new Error('Colonnes non reconnues. Utilisez un registre NC ou une checklist de préparation.');
  const headers = rows[headerIndex].map(normalize);
  const corrective = headers.some(c => c.includes('description des faits non conformes'));
  const column = (pattern: RegExp, fallback = -1) => { const index = headers.findIndex(c => pattern.test(c)); return index < 0 ? fallback : index; };
  const titleCol = column(corrective ? /description des faits/ : /checklist|point.*audit/);
  const numCol = column(/^n[°ºo]?\s*nc$|^num$|^n[°ºo]$/, 0);
  const dueCol = column(/echeance|deadline/);
  const ownerCol = column(corrective ? /responsable de l.action/ : /respons[aei]?ble|responsable|concerne/);
  const departmentCol = column(/^departement$/);
  const departmentOwnerCol = column(/responsable du departement/);
  const statusCol = column(/statut|satus|status/);
  const descriptionCol = column(/preparer/);
  const points: Point[] = [];
  const warnings: string[] = [];
  const numbers = new Set<number>();
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    const title = value(row[titleCol]);
    // Skip blank preformatted rows, footers and secondary headers.
    if (!title) continue;
    const rawNum = Number(row[numCol]);
    const num = Number.isInteger(rawNum) && rawNum > 0 ? rawNum : points.length + 1;
    if (numbers.has(num)) throw new Error(`Numéro ${num} en double dans la feuille « ${sheet} ».`);
    numbers.add(num);
    const get = (pattern: RegExp) => value(row[column(pattern)]);
    const status = normalize(row[statusCol]);
    const applicable = !/^(n\/?a|non applicable)$/.test(status);
    const done = /^(1|done|termine[e]?|cloture[e]?|closed|completed)$/.test(status);
    if (status && !done && applicable && !/^(0|in progress|en cours|ouvert[e]?|open|a faire|non commence[e]?)$/.test(status)) {
      warnings.push(`Ligne ${index + 1} : statut « ${value(row[statusCol])} » conservé en cours.`);
    }
    const due = excelDate(row[dueCol]);
    if (!due) warnings.push(`Ligne ${index + 1} : échéance ${value(row[dueCol]) ? 'invalide' : 'absente'}, date du projet utilisée.`);
    const reference = get(/reference de la nc/);
    const action = get(/action\(s\) corrective|actions? correctives?/);
    const correction = get(/^correction$/);
    const description = corrective ? action || correction || title : value(row[descriptionCol]);
    points.push({
      id: (audit === 'SMETA' ? 100000 : 0) + points.length + 1,
      num, audit,
      title: corrective ? `NC ${num} · ${reference || title.split('\n').find(t => t.trim()) || title}` : title.replace(/^\s*\d+[.)]?\s+/, ''),
      description,
      owner: value(row[ownerCol]) || value(row[departmentOwnerCol]) || value(row[departmentCol]) || 'Non assigné',
      department: value(row[departmentCol]), status: done ? 1 : 0, applicable,
      due: due || fallbackDue, requirements: description.split('\n').map(t => t.trim()).filter(Boolean), comments: [],
      ...(corrective ? { details: {
        facts: title, reference, ncType: get(/type de nc/), departmentOwner: value(row[departmentOwnerCol]),
        causes: get(/analyse des causes/), correction, correctiveAction: action,
        verificationDate: excelDate(row[column(/date de verification/)]),
        verification: get(/verification.*efficacite/), observations: get(/observations/),
        sourceFile: file, sourceSheet: sheet, sourceRow: index + 1,
      } } : {}),
    });
  }
  if (!points.length) throw new Error('Aucun point d’audit trouvé dans cette feuille.');
  return { points, warnings, sheet, file };
}

export async function importAuditFile(file: File, audit: AuditKind, fallbackDue: string): Promise<ImportResult> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Sélectionnez un fichier Excel au format .xlsx.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Le fichier doit faire moins de 10 Mo.');
  const { default: readExcelFile } = await import('read-excel-file/universal');
  const sheets = await readExcelFile(await file.arrayBuffer());
  const detailSheet = sheets.find(s => s.data.some(row => row.some(c => /description des faits non conformes|checklist|point.*audit/.test(normalize(c)))));
  if (!detailSheet) throw new Error('Aucune feuille de registre NC ou checklist reconnue.');
  return parseAuditRows(detailSheet.data, audit, file.name, detailSheet.sheet, fallbackDue);
}
