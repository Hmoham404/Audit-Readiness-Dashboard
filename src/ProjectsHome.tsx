import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from './i18n';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Cloud, FilePlus2, FileSpreadsheet, FolderOpen, Layers, Monitor, Plus, Search, ShieldCheck, X } from 'lucide-react';
import type { Point } from './data';
import type { AuditProject } from './projects';
import type { ProjectStore } from './useProjects';
import { ProjectNotice } from './ProjectNotice';

const summarize = (points: Point[]) => {
  const applicable = points.filter(point => point.applicable);
  const done = applicable.filter(point => point.status === 1).length;
  return { total: points.length, applicable: applicable.length, done, pending: applicable.length - done, na: points.length - applicable.length, percent: applicable.length ? Math.round(done / applicable.length * 100) : 0 };
};

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function ProgressCircle({ stats }: { stats: ReturnType<typeof summarize> }) { const { t, locale } = useLanguage();
  const length = 2 * Math.PI * 44;
  const done = stats.total ? stats.done / stats.total * length : 0;
  const pending = stats.total ? stats.pending / stats.total * length : 0;
  return <div className="project-progress-ring" role="img" aria-label={t("{0} % des points applicables sont terminés", { "0": stats.percent })} title={t("L’avancement exclut les points non applicables.")}>
    <svg viewBox="0 0 112 112" aria-hidden="true"><circle className="project-ring-track" cx="56" cy="56" r="44" fill="none" strokeWidth="8"/>
      <g transform="rotate(-90 56 56)"><circle className="project-ring-done" cx="56" cy="56" r="44" fill="none" strokeWidth="8" strokeDasharray={`${done} ${length}`} />
        <circle className="project-ring-pending" cx="56" cy="56" r="44" fill="none" strokeWidth="8" strokeDasharray={`${pending} ${length}`} strokeDashoffset={-done}/></g>
      <text className="project-ring-value" x="56" y="54" textAnchor="middle">{stats.percent}%</text><text className="project-ring-label" x="56" y="72" textAnchor="middle">{t("terminés")}</text>
    </svg>
  </div>;
}

function ProjectCard({ project, index, loading, onOpen }: { project: AuditProject; index: number; loading: boolean; onOpen: (id: string) => void }) { const { t, locale } = useLanguage();
  const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const stats = summarize(project.points);
  const corrective = project.points.some(point => point.details);
  const sources = Object.entries(project.sources);
  return <article className={`panel project-card ${corrective ? 'corrective-project' : 'preparation-project'}`} aria-labelledby={`project-title-${project.id}`}>
    <div className="project-card-top"><div className="project-identity"><span className="project-folder">{corrective ? <ShieldCheck size={21}/> : <FolderOpen size={21}/>}</span><span className="project-number">{t("PROJET ")}{String(index + 1).padStart(2, '0')}<b>{corrective ? t("Actions correctives") : t("Préparation aux audits")}</b></span></div>
      <span className={`project-storage ${project.storage}`}>{project.storage === 'shared' ? <Cloud size={12}/> : <Monitor size={12}/>} {project.storage === 'shared' ? t("Partagé") : t("Sur cet appareil")}</span>
    </div>
    <h2 id={`project-title-${project.id}`}>{project.name}</h2><p className="project-description">{project.description || t("Suivi des audits GMP et SMETA")}</p>
    <div className="project-progress-overview"><ProgressCircle stats={stats}/><div className="project-summary-copy"><span>{t("POINTS D’AUDIT")}</span><strong>{stats.total}<small>{t("points suivis")}</small></strong><p><b>{stats.done} / {stats.applicable}</b>{t(" points applicables terminés")}</p></div></div>
    <div className="project-status-legend"><span><i className="dot green"/><b>{stats.done}</b>{t(" terminés")}</span><span><i className="dot orange"/><b>{stats.pending}</b>{t(" en cours")}</span><span><i className="dot gray"/><b>{stats.na}</b>{t(" N/A")}</span></div>
    <div className="project-audit-list">{(['GMP', 'SMETA'] as const).map(audit => {
      const auditStats = summarize(project.points.filter(point => point.audit === audit));
      return <div className="project-audit-line" key={audit}>
        <div className="project-audit-heading"><span className={`audit-tag ${audit.toLowerCase()}`}>{audit}</span><span>{auditStats.total}{t(" points")}</span><b>{auditStats.percent}%</b></div>
        <div className="project-track" role="progressbar" aria-label={t("Avancement {0}", { "0": audit })} aria-valuenow={auditStats.percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${auditStats.percent}%` }}/></div>
        <div className="project-audit-meta"><span><CalendarDays size={11}/>{shortDate(project.deadlines[audit])}</span><span>{auditStats.done} / {auditStats.applicable}{t(" terminés")}</span></div>
      </div>;
    })}</div>
    <div className="project-card-bottom"><div className="project-source-slot">{sources.length ? <details className="project-sources"><summary><FileSpreadsheet size={15}/>{sources.length}{t(" fichiers importés ")}<ChevronDown size={12}/></summary><div className="project-source-files">{sources.map(([audit, source]) => <p key={audit}><b>{audit} · {source?.count}{t(" points")}</b><span>{source?.file}</span></p>)}</div></details> : <span className="project-checklist-label"><Layers size={15}/>{t(" Checklist du projet")}</span>}</div>
      <button className="primary-action" disabled={loading} onClick={() => onOpen(project.id)}>{t("Ouvrir le projet ")}<ArrowRight size={16}/></button>
    </div>
  </article>;
}

export function ProjectsHome({ store, onOpen, onCreate }: { store: ProjectStore; onOpen: (id: string) => void; onCreate: () => void }) { const { t, locale } = useLanguage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'preparation' | 'corrective'>('all');
  const totals = useMemo(() => summarize(store.projects.flatMap(project => project.points)), [store.projects]);
  const correctiveCount = store.projects.filter(project => project.points.some(point => point.details)).length;
  const sharedCount = store.projects.filter(project => project.storage === 'shared').length;
  const filtered = store.projects.filter(project => {
    const corrective = project.points.some(point => point.details);
    return (!query.trim() || normalize(`${project.name} ${project.description}`).includes(normalize(query.trim())))
      && (filter === 'all' || (filter === 'corrective' ? corrective : !corrective));
  });
  return <div className="app-shell projects-shell">
    <aside className="sidebar projects-sidebar">
      <div className="brand"><img className="brand-image" src="/MYC.png" alt="MYC Beauty Innovation Tunisia"/><div className="brand-sub">{t("Audit Readiness")}</div></div>
      <nav><button className="nav-item active" aria-current="page"><FolderOpen size={19}/><span>{t("Mes projets")}</span><b className="projects-nav-count">{store.projects.length}</b></button></nav>
      <div className="project-side-list"><span className="eyebrow">{t("ACCÈS RAPIDE")}</span>{store.projects.slice(0, 5).map(project => <button key={project.id} disabled={store.loading} onClick={() => onOpen(project.id)}><span className="project-side-dot"/><span>{project.name}</span><ArrowRight size={13}/></button>)}</div>
      <div className="side-bottom"><div className="project-side-status"><Cloud size={15}/><span>{t(sharedCount === 1 ? "{count} projet partagé" : "{count} projets partagés", { count: sharedCount })}</span></div><div className="side-seal"><Layers size={14}/>{t(" MYC BEAUTY INNOVATION")}</div><p>{t("La qualité, à chaque étape.")}</p></div>
    </aside>
    <main className="main"><header className="topbar"><div className="crumb"><span>{t("MYC BEAUTY INNOVATION")}</span><strong>{t("Espace de travail ")}<span className="projects-crumb-slash">/</span>{t(" Mes projets")}</strong></div><div className="top-actions"><LanguageSwitcher/><div className="today"><CalendarDays size={16}/>{new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div></header>
      <div className="content projects-content"><ProjectNotice store={store}/>
        <div className="page-intro projects-intro"><div><p><span/>{t(" VOTRE ESPACE DE SUIVI")}</p><h1>{t("Mes projets")}<span>.</span></h1><span>{t("Une vue claire sur vos audits et les actions qui les font avancer.")}</span></div><button className="primary-action" onClick={onCreate} disabled={store.loading}><Plus size={18}/>{t(" Nouveau projet")}</button></div>
        <section className="portfolio-stats" aria-label={t("Synthèse de tous les projets")}>
          <div><span className="portfolio-stat-icon"><FolderOpen size={18}/></span><div><span>{t("Projets")}</span><strong>{store.projects.length}</strong></div><small>{t("GMP & SMETA")}</small></div>
          <div><span className="portfolio-stat-icon"><Layers size={18}/></span><div><span>{t("Points suivis")}</span><strong>{totals.total}</strong></div><small>{t("Tous les projets")}</small></div>
          <div><span className="portfolio-stat-icon done"><CheckCircle2 size={18}/></span><div><span>{t("Points terminés")}</span><strong>{totals.done}</strong></div><small>{totals.percent}{t("% des points applicables")}</small></div>
          <div><span className="portfolio-stat-icon pending"><CalendarDays size={18}/></span><div><span>{t("Points en cours")}</span><strong>{totals.pending}</strong></div><small>{t("À suivre dans vos projets")}</small></div>
        </section>
        <section className="projects-collection" aria-labelledby="projects-list-heading">
          <div className="projects-list-toolbar"><div><h2 id="projects-list-heading">{t("Vos projets ")}<span>{store.projects.length}</span></h2><div className="project-filter-tabs" role="group" aria-label={t("Filtrer les projets")}>{([
            ['all', 'Tous', store.projects.length], ['preparation', 'Préparation', store.projects.length - correctiveCount], ['corrective', 'Actions correctives', correctiveCount],
          ] as const).map(([value, label, count]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{t(label)}<span>{count}</span></button>)}</div></div>
            <label className="projects-search"><Search size={17}/><input type="search" aria-label={t("Rechercher un projet")} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Rechercher un projet…")}/>{query && <button aria-label={t("Effacer la recherche")} onClick={() => setQuery('')}><X size={14}/></button>}</label>
          </div>
          <div className="projects-grid">{filtered.map(project => <ProjectCard key={project.id} project={project} index={store.projects.findIndex(item => item.id === project.id)} loading={store.loading} onOpen={onOpen}/>)}</div>
          {!filtered.length && <div className="projects-empty"><Search size={28}/><h3>{t("Aucun projet trouvé")}</h3><p>{t("Essayez un autre nom ou affichez tous les projets.")}</p><button className="outline-btn" onClick={() => { setQuery(''); setFilter('all'); }}>{t("Réinitialiser les filtres")}</button></div>}
        </section>
        <aside className="projects-next"><span className="projects-next-icon"><FilePlus2 size={25}/></span><div><h2>{t("Un nouvel audit à préparer ?")}</h2><p>{t("Importez vos fichiers Excel ou partez d’une checklist existante.")}</p></div><button className="outline-btn" onClick={onCreate} disabled={store.loading}>{t("Créer un projet ")}<ArrowRight size={15}/></button></aside>
      </div>
    </main>
  </div>;
}
