import updates from './corrective-departments.json';
import seed from './corrective-seed.json';
import type { Point } from './data';

export const CORRECTIVE_ID = 'corrective-october-2026';

/** Only migrate the supplied corrective records, never another project or a user's different department. */
export function correctedDepartment(projectId: string, point: Point): string | undefined {
  if (projectId !== CORRECTIVE_ID) return;
  const update = updates.find(item => item.audit === point.audit && item.num === point.num);
  if (!update || update.department === point.department || point.department !== update.previousDepartment) return;
  const original = seed[point.audit].points.find(item => item.num === point.num);
  if (!original || !point.details || point.details.facts !== original.details.facts) return;
  return update.department;
}

export function migrateLocalDepartments<T extends { id: string; points: Point[] }>(project: T): T {
  if (project.id !== CORRECTIVE_ID) return project;
  return { ...project, points: project.points.map(point => {
    const department = correctedDepartment(project.id, point);
    return department === undefined ? point : { ...point, department };
  }) };
}
