import { useEffect, useRef, useState } from 'react';
import { Check, FileSpreadsheet, Plus, X } from 'lucide-react';
import AuditWorkspace from './App';
import { type AuditKind } from './data';
import { importAuditFile, type ImportResult } from './excel-parser';
import { cloneChecklist, LEGACY_ID, type AuditProject } from './projects';
import { useProjects, type ProjectStore } from './useProjects';
import { ProjectsHome } from './ProjectsHome';

function CreateProjectModal({ store, onClose, onCreated }: { store: ProjectStore; onClose: () => void; onCreated: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tokens = useRef({ GMP: 0, SMETA: 0 });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'empty' | 'copy' | 'excel'>('empty');
  const [sourceId, setSourceId] = useState(LEGACY_ID);
  const [deadlines, setDeadlines] = useState<Record<AuditKind, string>>({ GMP: '', SMETA: '' });
  const [imports, setImports] = useState<Partial<Record<AuditKind, ImportResult>>>({});
  const [reading, setReading] = useState({ GMP: false, SMETA: false });
  const [importErrors, setImportErrors] = useState({ GMP: '', SMETA: '' });
  const [error, setError] = useState('');
  const busy = store.saving || reading.GMP || reading.SMETA;
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const read = async (audit: AuditKind, file: File | undefined) => {
    const token = ++tokens.current[audit];
    setImports(previous => { const next = { ...previous }; delete next[audit]; return next; });
    setImportErrors(previous => ({ ...previous, [audit]: '' }));
    if (!file) { setReading(previous => ({ ...previous, [audit]: false })); return; }
    setReading(previous => ({ ...previous, [audit]: true }));
    try {
      const result = await importAuditFile(file, audit, '');
      if (tokens.current[audit] === token) setImports(previous => ({ ...previous, [audit]: result }));
    } catch (cause) {
      if (tokens.current[audit] === token) setImportErrors(previous => ({ ...previous, [audit]: cause instanceof Error ? cause.message : 'Impossible de lire ce fichier Excel.' }));
    } finally {
      if (tokens.current[audit] === token) setReading(previous => ({ ...previous, [audit]: false }));
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim() || !deadlines.GMP || !deadlines.SMETA || busy) return;
    if (mode === 'excel' && (!imports.GMP || !imports.SMETA || importErrors.GMP || importErrors.SMETA)) {
      setError('Choisissez un fichier Excel valide pour GMP et un autre pour SMETA.'); return;
    }
    const source = store.projects.find(project => project.id === sourceId);
    const points = mode === 'excel' ? [...imports.GMP!.points, ...imports.SMETA!.points].map(p => ({ ...p, due: p.due || deadlines[p.audit] }))
      : mode === 'copy' ? cloneChecklist(source?.points || []).map(p => ({ ...p, due: deadlines[p.audit] })) : [];
    const project: AuditProject = {
      id: crypto.randomUUID(), name: name.trim(), description: description.trim(), createdAt: new Date().toISOString(),
      deadlines, points, storage: 'local', sources: mode === 'excel' ? Object.fromEntries(Object.entries(imports).map(([audit, result]) => [audit, { file: result!.file, sheet: result!.sheet, count: result!.points.length }])) : {},
    };
    if (await store.create(project)) onCreated(project.id);
    else setError('Le projet n’a pas pu être enregistré. Réessayez ; les fichiers sélectionnés sont conservés dans cette fenêtre.');
  };
  return <dialog className="project-dialog" ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="new-project-title">
    <form onSubmit={submit}><div className="drawer-head"><div><span className="eyebrow">UN NOUVEL ESPACE DE SUIVI</span><h2 id="new-project-title">Créer un projet</h2></div><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>
      <div className="project-form-body"><label className="project-field">Nom du projet<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Préparation aux audits — 2027"/></label>
        <label className="project-field">Description <span className="optional">(facultatif)</span><input maxLength={300} value={description} onChange={e => setDescription(e.target.value)} placeholder="Objectif ou périmètre du projet"/></label>
        <fieldset className="project-modes"><legend>Comment souhaitez-vous commencer ?</legend>{([
          ['empty', 'Projet vide', 'Ajoutez vos propres points au fur et à mesure.'],
          ['copy', 'Copier une checklist', 'Reprenez les exigences, avec les statuts remis en cours.'],
          ['excel', 'Importer Excel', 'Un fichier GMP et un fichier SMETA, avec leurs statuts.'],
        ] as const).map(([value, title, detail]) => <label className={`project-mode ${mode === value ? 'selected' : ''}`} key={value}><input type="radio" name="project-mode" value={value} checked={mode === value} disabled={busy} onChange={() => setMode(value)}/><span><b>{title}</b><small>{detail}</small></span></label>)}</fieldset>
        {mode === 'copy' && <label className="project-field">Projet à copier<select value={sourceId} onChange={e => setSourceId(e.target.value)}>{store.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
        <div className="project-date-fields">{(['GMP', 'SMETA'] as const).map(audit => <label className="project-field" key={audit}>Date d’audit {audit}<input required type="date" value={deadlines[audit]} onChange={e => setDeadlines(previous => ({ ...previous, [audit]: e.target.value }))}/></label>)}</div>
        {mode === 'excel' && <div className="project-imports">{(['GMP', 'SMETA'] as const).map(audit => <div className="project-import" key={audit}><label className="project-field"><span><FileSpreadsheet size={16}/> Fichier Excel {audit}</span><input type="file" accept=".xlsx" disabled={store.saving} onChange={e => { void read(audit, e.target.files?.[0]); }}/></label>
          {reading[audit] && <p role="status">Lecture du fichier…</p>}{importErrors[audit] && <p className="import-error" role="alert">{importErrors[audit]}</p>}
          {imports[audit] && <div className="import-preview"><p><Check size={14}/>{imports[audit]!.points.length} points reconnus · {imports[audit]!.points.filter(p => p.status === 1 && p.applicable).length} terminés</p><small>Feuille : {imports[audit]!.sheet}</small>{!!imports[audit]!.warnings.length && <details><summary>{imports[audit]!.warnings.length} remarque(s) à vérifier</summary>{imports[audit]!.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}</div>}
        </div>)}<p className="project-form-note">Formats reconnus : registre de non-conformités et checklist de préparation. Les fichiers sources restent inchangés. Les statuts vides sont considérés en cours.</p></div>}
        <p className="project-form-note">{store.sharingAvailable ? 'Ce projet sera partagé avec les autres utilisateurs.' : 'Ce projet sera enregistré sur cet appareil.'}</p>
        {error && <p className="import-error" role="alert">{error}</p>}
      </div><div className="project-form-footer"><button type="button" className="outline-btn" disabled={busy} onClick={onClose}>Annuler</button><button className="primary-action" disabled={busy || store.loading}><Plus size={16}/>{store.saving ? 'Création…' : 'Créer le projet'}</button></div>
    </form>
  </dialog>;
}

export default function ProjectsApp() {
  const store = useProjects();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const project = store.projects.find(p => p.id === activeId);
  return <>
    {project ? <AuditWorkspace key={project.id} project={project} store={store} onHome={() => setActiveId(null)} onSelect={setActiveId} onCreate={() => setCreating(true)}/>
      : <ProjectsHome store={store} onOpen={setActiveId} onCreate={() => setCreating(true)}/>}
    {creating && <CreateProjectModal store={store} onClose={() => setCreating(false)} onCreated={id => { setActiveId(id); setCreating(false); }}/ >}
  </>;
}
