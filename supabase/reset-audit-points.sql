-- ATTENTION : script destructif. Il efface tous les points d'audit de ce projet.
-- Ne l'exécuter que si vous souhaitez vraiment repartir des données d'exemple.
-- Les éventuels fichiers d'un ancien bucket Supabase ne sont pas supprimés.
begin;
delete from public.audit_points;
commit;

-- L'application respecte désormais une table vide et ne réinsère pas les points.
-- Pour un suivi indépendant, utiliser « Nouveau projet » sans exécuter ce script.
