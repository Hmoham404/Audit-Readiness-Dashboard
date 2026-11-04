import { initialPoints, type AuditKind, type Point } from './data';
import correctiveSeed from './corrective-seed.json';

export const LEGACY_ID = 'preparation-2026';
export const LEGACY_POINTS_KEY = 'myc-audit-points-excel-v1';
export const LEGACY_DATES_KEY = 'myc-audit-deadlines-v1';
export const PROJECTS_KEY = 'myc-audit-projects-v1';
export const DEFAULT_DEADLINES: Record<AuditKind, string> = { GMP: '2026-10-09', SMETA: '2026-10-16' };
export type SourceInfo = { file: string; sheet: string; count: number };
export type AuditProject = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  deadlines: Record<AuditKind, string>;
  points: Point[];
  sources: Partial<Record<AuditKind, SourceInfo>>;
  storage: 'local' | 'shared';
};

const copy = <T,>(data: T): T => JSON.parse(JSON.stringify(data));
export function initialProjects(storage: Pick<Storage, 'getItem'>, sharedLegacy: boolean): AuditProject[] {
  const read = <T,>(key: string, fallback: T): T => { try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const legacy: AuditProject = {
    id: LEGACY_ID, name: 'Préparation aux audits — 2026', description: 'Projet initial · préparation GMP et SMETA',
    createdAt: '2026-10-01T00:00:00Z', deadlines: { ...DEFAULT_DEADLINES, ...read(LEGACY_DATES_KEY, {}) },
    points: read(LEGACY_POINTS_KEY, copy(initialPoints)), sources: {}, storage: sharedLegacy ? 'shared' : 'local',
  };
  const saved = read<AuditProject[]>(PROJECTS_KEY, []);
  const projects = Array.isArray(saved) ? saved.filter(p => p.id !== LEGACY_ID && Array.isArray(p.points) && p.name && p.deadlines) : [];
  if (!projects.some(p => p.id === 'corrective-october-2026')) projects.unshift({
    id: 'corrective-october-2026', name: 'Actions correctives — octobre 2026',
    description: 'Suivi des non-conformités relevées lors des audits GMP et SMETA',
    createdAt: '2026-11-04T12:53:00Z', deadlines: { GMP: '2026-10-19', SMETA: '2026-10-08' },
    points: copy([...correctiveSeed.GMP.points, ...correctiveSeed.SMETA.points]) as Point[],
    sources: Object.fromEntries(Object.entries(correctiveSeed).map(([audit, result]) => [audit, { file: result.file, sheet: result.sheet, count: result.points.length }])),
    storage: 'local',
  });
  return [legacy, ...projects];
}

export function cloneChecklist(points: Point[]): Point[] {
  return copy(points).map(point => ({
    ...point, status: 0, comments: [],
    ...(point.details ? { details: { ...point.details, verification: '', verificationDate: '', observations: '' } } : {}),
  }));
}

export const newPointId = () => {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return (values[0] & 0xffff) * 4294967296 + values[1];
};

export function projectRow(project: AuditProject) {
  return { id: project.id, name: project.name, description: project.description, created_at: project.createdAt, deadlines: project.deadlines, sources: project.sources };
}

export const fromLegacyRow = (row: Omit<Point, 'num'> & { num?: number }): Point => ({ ...row, num: row.num ?? (row.audit === 'GMP' ? row.id : row.id - 100) });
export const toLegacyRow = ({ num: _num, details: _details, ...row }: Point) => row;
