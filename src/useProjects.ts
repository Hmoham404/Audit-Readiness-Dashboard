import { useEffect, useRef, useState } from 'react';
import type { AuditKind, Point } from './data';
import { supabase } from './supabase';
import { initialProjects, LEGACY_DATES_KEY, LEGACY_ID, LEGACY_POINTS_KEY, PROJECTS_KEY, fromLegacyRow, projectRow, toLegacyRow, type AuditProject } from './projects';

type SharedProject = ReturnType<typeof projectRow> & { audit_project_points: (Point & { project_id?: string })[] };
const fromShared = (row: SharedProject): AuditProject => ({
  id: row.id, name: row.name, description: row.description, createdAt: row.created_at,
  deadlines: row.deadlines, sources: row.sources, storage: 'shared',
  points: row.audit_project_points.map(({ project_id: _project, ...point }) => point).sort((a, b) => a.audit.localeCompare(b.audit) || a.num - b.num),
});

export function useProjects(database = supabase) {
  const [projects, setProjects] = useState(() => initialProjects(localStorage, !!database));
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const [loading, setLoading] = useState(!!database);
  const [sharingAvailable, setSharingAvailable] = useState(false);
  const [legacyDatesInProjects, setLegacyDatesInProjects] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    try {
      const legacy = projects.find(p => p.id === LEGACY_ID)!;
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.filter(p => p.id !== LEGACY_ID)));
      localStorage.setItem(LEGACY_POINTS_KEY, JSON.stringify(legacy.points));
      localStorage.setItem(LEGACY_DATES_KEY, JSON.stringify(legacy.deadlines));
      setStorageError('');
    } catch {
      setStorageError('Le stockage de ce navigateur est plein ou indisponible. Les changements locaux ne peuvent pas être conservés.');
    }
  }, [projects]);

  useEffect(() => {
    const client = database;
    if (!client) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    const load = async () => {
      try {
        const [legacyPoints, legacyDates, catalog] = await Promise.all([
          client.from('audit_points').select('*').abortSignal(controller.signal),
          client.from('audit_settings').select('audit,due').abortSignal(controller.signal),
          client.from('audit_projects').select('*, audit_project_points(*)').order('created_at').abortSignal(controller.signal),
        ]);
        if (!active) return;
        const errors: string[] = [];
        const catalogRows = (catalog.data || []) as SharedProject[];
        let legacyMetadata = catalogRows.find(row => row.id === LEGACY_ID);
        // Older installations may never have created audit_settings. Reuse the
        // modern metadata table without moving or rewriting any legacy points.
        if (!legacyMetadata && legacyDates.error?.code === 'PGRST205' && !catalog.error) {
          const legacy = projectsRef.current.find(project => project.id === LEGACY_ID)!;
          const { error } = await client.rpc('create_audit_project', {
            p_project: { ...projectRow(legacy), points: [] },
          }).abortSignal(controller.signal);
          if (!error) {
            const { data } = await client.from('audit_projects').select('*, audit_project_points(*)')
              .eq('id', LEGACY_ID).abortSignal(controller.signal).single();
            if (data) legacyMetadata = data as SharedProject;
          }
        }
        if (!active) return;
        setLegacyDatesInProjects(!!legacyMetadata);
        if (legacyPoints.error) errors.push('Les points du projet initial ne peuvent pas être actualisés. Leur dernier état enregistré reste affiché.');
        if (legacyDates.error && !legacyMetadata) errors.push('Les dates d’audit du projet initial ne sont pas synchronisées. Les dates enregistrées sur cet appareil restent affichées.');
        setProjects(previous => previous.map(project => project.id !== LEGACY_ID ? project : {
          ...project,
          // An empty remote table is authoritative: never re-seed deleted live data.
          points: legacyPoints.data ? legacyPoints.data.map(fromLegacyRow) : project.points,
          deadlines: legacyMetadata ? { ...project.deadlines, ...legacyMetadata.deadlines }
            : legacyDates.data ? { ...project.deadlines, ...Object.fromEntries(legacyDates.data.map(row => [row.audit, row.due])) } : project.deadlines,
        }));
        if (catalog.error) {
          setSharingAvailable(false);
          errors.push('Le partage des nouveaux projets est indisponible. Les projets indiqués « Sur cet appareil » sont conservés dans ce navigateur.');
        } else {
          setSharingAvailable(true);
          // The legacy header holds dates only; its points remain in audit_points.
          const remote = catalogRows.filter(row => row.id !== LEGACY_ID).map(fromShared);
          const remoteIds = new Set(remote.map(p => p.id));
          // Atomic creation is idempotent. Existing remote projects are never overwritten by a seed or old cache.
          for (const project of projectsRef.current.filter(p => p.id !== LEGACY_ID && !remoteIds.has(p.id))) {
            if (!active) return;
            const { error } = await client.rpc('create_audit_project', { p_project: { ...projectRow(project), points: project.points } }).abortSignal(controller.signal);
            if (error) {
              errors.push('Certains projets sont encore enregistrés uniquement sur cet appareil. Réessayez la synchronisation.');
              continue;
            }
            const { data, error: readError } = await client.from('audit_projects').select('*, audit_project_points(*)').eq('id', project.id).abortSignal(controller.signal).single();
            if (!readError && data) remote.push(fromShared(data as SharedProject));
          }
          if (!active) return;
          setProjects(previous => {
            const shared = new Map(remote.map(p => [p.id, p]));
            const merged = previous.map(p => shared.get(p.id) || p);
            const known = new Set(merged.map(p => p.id));
            return [...merged, ...remote.filter(p => !known.has(p.id))];
          });
        }
        setConnectionError([...new Set(errors)].join(' '));
      } catch {
        if (active) setConnectionError('Connexion indisponible. Le dernier état enregistré sur cet appareil reste affiché.');
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [revision, database]);

  useEffect(() => {
    if (!database) return;
    const client = database;
    // Debounce the multiple events emitted by a project import.
    let timer: number;
    const refresh = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setRevision(n => n + 1), 500); };
    const legacyChannel = client.channel('audit-legacy-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_points' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_settings' }, refresh).subscribe();
    // Missing new tables must not prevent the original project's live subscription.
    const projectChannel = sharingAvailable ? client.channel('audit-projects-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_projects' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_project_points' }, refresh).subscribe() : null;
    return () => { window.clearTimeout(timer); void client.removeChannel(legacyChannel); if (projectChannel) void client.removeChannel(projectChannel); };
  }, [database, sharingAvailable]);

  const replace = (id: string, change: (project: AuditProject) => AuditProject) => {
    // Keep the ref current for operations that complete before React's next render.
    const next = projectsRef.current.map(p => p.id === id ? change(p) : p);
    projectsRef.current = next;
    setProjects(next);
  };
  const mutate = async (projectId: string, operation: 'update' | 'add' | 'remove', id: number, change?: Partial<Point>) => {
    const project = projectsRef.current.find(p => p.id === projectId);
    if (!project || loading || inFlight.current) return false;
    const old = project.points.find(p => p.id === id);
    if (operation !== 'add' && !old) return false;
    let point = { ...old, ...change, id } as Point;
    inFlight.current = true;
    setSaving(true);
    try {
      if (project.storage === 'shared' && database) {
        const legacy = project.id === LEGACY_ID;
        const table = database.from(legacy ? 'audit_points' : 'audit_project_points');
        if (operation === 'add') {
          const payload = legacy ? toLegacyRow(point) : { ...point, project_id: project.id };
          const { error } = await table.insert(payload).abortSignal(AbortSignal.timeout(12000));
          if (error) return false;
        } else {
          let query = operation === 'remove' ? table.delete() : table.update(legacy ? toLegacyRow(point) : change!);
          query = query.eq('id', id);
          if (!legacy) query = query.eq('project_id', project.id);
          const { data, error } = await query.select('*').abortSignal(AbortSignal.timeout(12000)).single();
          if (error || !data) return false;
          if (operation === 'update') {
            const { project_id: _project, ...saved } = data;
            point = legacy ? { ...fromLegacyRow(saved as Point), num: point.num } : saved as Point;
          }
        }
      }
      replace(projectId, p => ({ ...p, points: operation === 'remove' ? p.points.filter(row => row.id !== id) : operation === 'add' ? [...p.points, point] : p.points.map(row => row.id === id ? point : row) }));
      return true;
    } catch { return false; } finally { inFlight.current = false; setSaving(false); }
  };
  const create = async (project: AuditProject) => {
    if (loading || inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    try {
      let created = project;
      if (database && sharingAvailable) {
        const { error } = await database.rpc('create_audit_project', { p_project: { ...projectRow(project), points: project.points } }).abortSignal(AbortSignal.timeout(15000));
        if (error) return false;
        created = { ...project, storage: 'shared' };
      }
      const next = [...projectsRef.current, created];
      projectsRef.current = next;
      setProjects(next);
      return true;
    } catch { return false; } finally { inFlight.current = false; setSaving(false); }
  };
  const saveDeadline = async (projectId: string, audit: AuditKind, due: string) => {
    const project = projectsRef.current.find(p => p.id === projectId);
    if (!project || loading || inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    try {
      if (database && project.storage === 'shared') {
        const { error } = project.id === LEGACY_ID && !legacyDatesInProjects
          ? await database.from('audit_settings').upsert({ audit, due }).abortSignal(AbortSignal.timeout(12000))
          : await database.rpc('set_audit_project_deadline', { p_project_id: projectId, p_audit: audit, p_due: due }).abortSignal(AbortSignal.timeout(12000));
        if (error) return false;
      }
      replace(projectId, p => ({ ...p, deadlines: { ...p.deadlines, [audit]: due } }));
      return true;
    } catch { return false; } finally { inFlight.current = false; setSaving(false); }
  };
  return {
    projects, loading, saving, connectionError, storageError, sharingAvailable,
    retry: () => setRevision(n => n + 1), create, saveDeadline,
    update: (projectId: string, id: number, change: Partial<Point>) => mutate(projectId, 'update', id, change),
    add: (projectId: string, point: Point) => mutate(projectId, 'add', point.id, point),
    remove: (projectId: string, id: number) => mutate(projectId, 'remove', id),
  };
}
export type ProjectStore = ReturnType<typeof useProjects>;
