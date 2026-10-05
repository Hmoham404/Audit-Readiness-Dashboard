# MYC Audit Readiness

Interface Vite + React + TypeScript de suivi des audits GMP et SMETA. L’application est sans connexion. Les colonnes Documents et Département ne sont pas affichées dans les tableaux.

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
4. Redémarrez Vite avec `npm run dev`. La première ouverture ajoute automatiquement les données GMP et SMETA dans une table vide.

`.env.example` ne contient que des noms de variables et des valeurs vides : ne mettez pas vos clés réelles dedans. `.env.local` est ignoré par Git. Utilisez uniquement la clé publique anon/publishable côté navigateur, jamais une clé `service_role`/secret.

Pour remplacer les lignes existantes et réimporter les valeurs Excel, exécutez [`supabase/reset-audit-points.sql`](supabase/reset-audit-points.sql) dans le SQL Editor puis rechargez l’application. Le script efface irréversiblement les lignes actuelles de la table.

Les droits SQL fournis autorisent tout visiteur anonyme à lire et modifier tous les points, comme demandé. Ne stockez pas de données personnelles sensibles dans cette instance publique.

## Déploiement Vercel

Importer le dépôt dans Vercel (preset Vite, commande de build `npm run build`, sortie `dist`) et ajouter les deux variables d’environnement Supabase. Le lien Vercel ouvre le dashboard directement, sans authentification.

## Statuts

`status = 0` signifie In Progress et `status = 1` signifie Done. `applicable = false` affiche N/A et exclut le point du dénominateur de progression.
