# Lexora

Plateforme d'affiliation autonome (HTML/CSS/JS) avec backend Vercel Serverless Functions & Supabase.

## Fonctionnalités

- Dashboard d'affiliation multi-rôles (Admin, Sous-chef, Membre).
- Intégration Supabase pour le stockage des données et des abonnements Push.
- API Postback pour synchroniser les enregistrements, FTD, dépôts et revenus.
- Statistiques quotidiennes par code affilié.

## Déploiement

Déployez ce projet sur [Vercel](https://vercel.com) avec les variables d'environnement suivantes :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ADMIN_API_KEY`
- `POSTBACK_API_KEY`

Exécutez `supabase-schema.sql` dans l'éditeur SQL de Supabase pour configurer la base de données.
