import { RefreshCw } from 'lucide-react';
import type { ProjectStore } from './useProjects';

export function ProjectNotice({ store }: { store: ProjectStore }) {
  if (store.storageError) return <div className="project-notice error" role="alert">{store.storageError}</div>;
  if (store.loading) return <div className="project-notice" role="status"><RefreshCw size={15} className="spin"/>Actualisation des projets…</div>;
  if (store.connectionError) return <div className="project-notice" role="status"><span>{store.connectionError}</span><button className="text-btn" onClick={store.retry}><RefreshCw size={14}/> Réessayer</button></div>;
  return null;
}
