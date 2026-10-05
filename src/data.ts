import seedData from './audit-seed.json';

export type AuditKind = 'GMP' | 'SMETA';
export type Point = {
  id: number;
  num: number;
  audit: AuditKind;
  title: string;
  description: string;
  owner: string;
  department: string;
  status: 0 | 1;
  applicable: boolean;
  due: string;
  requirements: string[];
  comments: string[];
};

export const initialPoints = seedData as Point[];
export const ownersList = [...new Set(initialPoints.map(point => point.owner).filter(Boolean))].sort();
