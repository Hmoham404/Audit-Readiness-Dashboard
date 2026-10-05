-- ATTENTION : script destructif. Il efface tous les points d'audit de ce projet.
-- Ne l'exécuter que si vous souhaitez vraiment repartir des données d'exemple.
-- Les éventuels fichiers d'un ancien bucket Supabase ne sont pas supprimés.
begin;
delete from public.audit_points;
commit;

-- Après exécution, ouvrez/rechargez l'application avec Supabase configuré.
-- Elle détecte la table vide et réinsère automatiquement les points de départ
-- GMP et SMETA définis dans src/data.ts.
