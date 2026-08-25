# GIVT full project export

This archive contains the current GIVT source project ready to upload to GitHub:
React frontend, Express/Prisma backend, database migrations and seed data, Keycloak
realm structure, package lockfiles, Replit configuration, setup scripts, and docs.

## Intentionally omitted

- Secret and local environment files, including `server/.neon`
- `node_modules`, caches, and generated `dist` output
- Replit Agent/internal workspace directories
- Duplicate `*-Tinsae` snapshot files
- Keycloak bootstrap users and passwords

## Before running from GitHub

1. Copy `server/.env.example` to `server/.env` and fill in the required values using a
   secret manager or local environment file. Do not commit `server/.env`.
2. Configure PostgreSQL and run the Prisma migrations.
3. Configure Keycloak using `keycloak/givt-realm.json`, then update URLs and redirect
   URIs for the new environment.
4. Install dependencies with `npm install` and `cd server && npm install`.
5. Run `npm run db:seed` only against a development/demo database.
6. Follow `README.md` and `QUICKSTART.md` for local development and deployment.
