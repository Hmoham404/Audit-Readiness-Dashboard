# MYC Audit Readiness

Interface Vite + React + TypeScript de suivi des audits GMP et SMETA. L’application est sans connexion. Les colonnes Documents et Département ne sont pas affichées dans les tableaux.

## Projets et import Excel

L’accueil **Mes projets** permet d’ouvrir un projet ou d’en créer un. Le sélecteur **Projet actif** permet ensuite de passer d’un projet à l’autre. Les tableaux, compteurs, responsables, échéances, commentaires et alertes sont propres au projet sélectionné.

Deux projets sont disponibles au premier lancement :

- **Préparation aux audits — 2026** : les points et les dates déjà enregistrés dans `audit_points`, `audit_settings` ou les anciennes clés du navigateur sont conservés. Les responsables modifiés ne sont plus réinitialisés d’après le fichier initial.
- **Actions correctives — octobre 2026** : les deux rapports MYCTN-FM-QM-007 fournis sont intégrés dans `src/corrective-seed.json` : 8 non-conformités GMP et 7 SMETA, dont 2 SMETA clôturées. Les faits, références, responsables, actions, échéances et informations de vérification restent consultables dans le détail. La date GMP du 19/10/2026 est reprise du nom du fichier, car son en-tête recopie la date du rapport SMETA ; la date SMETA du 08/10/2026 correspond au début de l’audit indiqué 08/09-10-2026. Les échéances des actions sont celles des cellules Excel.

La création propose un projet vide, une copie de checklist (statuts remis en cours, commentaires et vérifications effacés, échéances remplacées par les nouvelles dates du projet), ou deux imports `.xlsx`, un par audit. Les registres NC et les deux formats de checklist de préparation existants sont reconnus. Un aperçu des nombres de points et des avertissements est affiché avant création. Les statuts Excel sont conservés à l’import ; un statut vide reste en cours. Les fichiers Excel originaux ne sont jamais modifiés.

### Activer le partage des nouveaux projets

Dans le **projet Supabase existant**, exécuter une fois [`supabase/projects.sql`](supabase/projects.sql) dans SQL Editor, puis cliquer **Réessayer** dans l’application ou recharger la page.

Ce script ajoute `audit_projects`, `audit_project_points` et deux fonctions de sauvegarde. Il ne modifie ni ne vide les tables du projet initial. La création d’un projet et de ses points est atomique ; le même import au rechargement ne remplace jamais un projet déjà enregistré en ligne. Les identifiants des points et leurs numéros sont conservés séparément dans les nouveaux projets.

Si une ancienne installation ne possède pas `audit_settings`, l’application crée uniquement les métadonnées du projet initial dans `audit_projects`, en conservant ses dates enregistrées sur le navigateur. Ses points restent dans `audit_points`. Les dates utilisent ensuite les mêmes fonctions de partage que les nouveaux projets ; il n’est pas nécessaire de créer une seconde table de dates. Une métadonnée déjà partagée est prioritaire et n’est jamais remplacée par le cache d’un autre navigateur.

Tant que ce partage n’est pas disponible, les nouveaux projets portent la mention **Sur cet appareil** et sont enregistrés dans le navigateur. Les projets partagés déjà chargés ne basculent pas silencieusement en mode local en cas d’échec de sauvegarde. Lors de l’activation du partage, un projet local absent en ligne est importé ; si le même identifiant existe déjà en ligne, sa version partagée fait autorité.

### Vérifications

`npm test` vérifie les imports réels, la conservation du projet initial, l’indépendance des modifications et des dates, le rechargement local, le parcours de création et de sélection, et le script SQL dans une base PostgreSQL embarquée de test. `npm run build` vérifie TypeScript et produit `dist/`. Ces tests ne se connectent pas à la base Supabase en service. Le parcours d’interface est testé avec un DOM simulé ; une vérification visuelle dans un navigateur reste distincte.

`npm run import:corrective` régénère les données initiales du deuxième projet à partir des deux rapports présents à la racine (Node 24). Cette commande de préparation ne réimporte pas les projets déjà enregistrés par les utilisateurs.

Les données initiales proviennent des classeurs `Suivi de préparation audit GMP.xlsx` et `Checklist de suivi d'audit SMETA.xlsx` placés à la racine : 54 points GMP et 53 points SMETA. Les consignes « À préparer », responsables, dates, statuts et notes disponibles sont intégrés. Les cellules de statut vides sont interprétées comme `0 = In Progress` ; les mentions `NA` ou `N/A` sont marquées non applicables. Les classeurs originaux ne sont pas modifiés.

## Démarrage local

```sh
npm install
npm run dev
```

Sans paramètres Supabase, l’interface fonctionne en mode démonstration et conserve les modifications dans le stockage local du navigateur. Pour le mode partagé :

1. Créez un seul projet Supabase pour cette application.
2. Dans Supabase → SQL Editor, exécutez [`supabase/schema.sql`](supabase/schema.sql) une fois.
3. Copiez `.env.example` en `.env.local` à la racine du projet et renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` depuis les paramètres API du projet Supabase.
4. Pour un nouveau déploiement, importer les points initiaux dans `audit_points` avant l’usage partagé. L’application ne réinsère pas automatiquement les points d’une table vide, afin de respecter les suppressions effectuées en ligne. Sans Supabase, le premier projet démarre avec les points des fichiers de préparation.

`.env.example` ne contient que des noms de variables et des valeurs vides : ne mettez pas vos clés réelles dedans. `.env.local` est ignoré par Git. Utilisez uniquement la clé publique anon/publishable côté navigateur, jamais une clé `service_role`/secret.

Le script [`supabase/reset-audit-points.sql`](supabase/reset-audit-points.sql) efface irréversiblement les lignes du projet initial. Il n’est pas nécessaire pour créer un projet ; utilisez la fenêtre **Nouveau projet** pour un nouveau suivi indépendant.

Les droits SQL fournis autorisent tout visiteur anonyme à lire et modifier tous les points, comme demandé. Ne stockez pas de données personnelles sensibles dans cette instance publique.

## Déploiement Vercel

Importer le dépôt dans Vercel (preset Vite, commande de build `npm run build`, sortie `dist`) et ajouter les deux variables d’environnement Supabase. Le lien Vercel ouvre le dashboard directement, sans authentification.

## Statuts

`status = 0` signifie In Progress et `status = 1` signifie Done. `applicable = false` affiche N/A et exclut le point du dénominateur de progression.
