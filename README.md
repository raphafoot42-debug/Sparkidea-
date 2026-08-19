# Lexora / AffiniX - Plateforme d'Affiliation

Plateforme d'affiliation complète avec un frontend web réactif (`index.html`), des fonctions Serverless Vercel (`/api`) et une base de données Supabase.

## Architecture

- **Frontend** : `index.html` (HTML / CSS / Vanilla JS avec Chart.js)
- **Backend API (Vercel Serverless Functions)** :
  - `GET /api/db` & `POST /api/db` : Synchronisation globale du state de l'application.
  - `POST /api/signup` : Inscription d'un sous-affilié via lien de parrainage.
  - `GET/POST /api/postback` : Réception des événements de réseau d'affiliation (`register`, `ftd`, `deposit`, `cpa`, `ngr`).
  - `GET /api/stats/[code]` : Récupération des statistiques quotidiennes par code affilié.
- **Base de données** : Supabase PostgreSQL (`supabase-schema.sql`).

## Configuration Supabase

Dans Supabase → **SQL Editor** → **New query** → Exécuter le contenu de `supabase-schema.sql` :

Tables créées :
- `app_db` : Stockage de la base de données de l'application (données JSON).
- `push_subscriptions` : Subscriptions pour les notifications push.
- `postback_daily_stats` : Statistiques quotidiennes par affilié.
- `postback_log` : Logs bruts des postbacks reçus.

## Variables d'Environnement Vercel

Dans Vercel → **Settings** → **Environment Variables** :

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | URL de votre projet Supabase (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Clé `service_role` de Supabase (jamais exposée côté client) |
| `ADMIN_API_KEY` | Clé secrète d'administration (correspond à `SYNC_API_KEY` dans `index.html`) |
| `POSTBACK_API_KEY` | Clé d'API pour sécuriser la réception des webhooks/postbacks (`?key=...`) |

## Déploiement

Déployer la racine du projet directement sur Vercel. Les fonctions `/api/*` sont automatiquement détectées.
