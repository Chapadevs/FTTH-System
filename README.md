# FiberOps

Internal web platform for telecom field engineers to manage FTTX fiber network deployments.

## Structure

```
fiberops/
├── frontend/     # React + Vite app
├── backend/      # Express + tRPC + Prisma API
├── docker-compose.yml
└── package.json
```

## Prerequisites

- Node 20
- Docker
- gcloud CLI (for GCP deployment)

## Local Development

```bash
git clone <repo-url>
cd fiberops
docker compose up -d
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

- **Web (Vite)**: http://localhost:8080
- **API (Express)**: http://localhost:3000/health

Note: Ensure Docker is running before `docker compose up -d`. If Postgres is not available, migrations and seed will fail. Imports and other authenticated API calls require at least one user—**`npm run db:seed`** creates `admin@fiberops.com` and sample data; skipping seed leads to `UNAUTHORIZED` on import.

### Windows: Prisma `EPERM` / `query_engine-windows.dll.node`

`npm run db:migrate` runs **`prisma migrate deploy`** (applies migrations only; it does **not** run `prisma generate`), so it avoids the query-engine rename error during normal setup.

Use **`npm run db:generate`** after install or whenever the Prisma schema changes. If `db:generate` still fails with `EPERM`, stop **`npm run dev`** and any other Node processes, then retry. Creating **new** migrations uses **`npm run db:migrate:dev`** (`prisma migrate dev`), which does run generate at the end—close the dev server first on Windows.

OneDrive on the Desktop folder often locks files; exclude `node_modules` and `backend/src/generated` from sync, or move the repo outside OneDrive.

## GCP Deployment

### One-time GCP setup (manual)

1. **APIs**: Enable Cloud Run, Artifact Registry, Cloud SQL Admin, Secret Manager (optional).
2. **Artifact Registry**: Create Docker repository named `ftth-system` (or change `AR_REPO` in `.github/workflows/deploy-gcp.yml`).
3. **Cloud SQL**: PostgreSQL 16, database `fiberops`, user/password. For GitHub Actions migrations you need a **TCP** reachable URL in `DATABASE_URL` (e.g. public IP + authorized network, or run migrations yourself from a machine with Cloud SQL Auth Proxy).
4. **Service account** (for GitHub):
   - Roles: `Artifact Registry Writer`, `Cloud Run Admin`, `Service Account User`
   - If using Cloud SQL connector on Run: `Cloud SQL Client` on the **runtime** service account (see Cloud Run service settings).
5. **JSON key**: Create key for that service account → entire JSON → GitHub secret `GCP_SA_KEY`.

### GitHub Actions (simple: JSON key only)

Workflow: `.github/workflows/deploy-gcp.yml` (runs on push to `main`).

| Secret | Required | Description |
|--------|----------|-------------|
| `GCP_SA_KEY` | Yes | Full JSON of the service account key |
| `GCP_PROJECT_ID` | Yes | GCP project ID |
| `DATABASE_URL` | Yes | Postgres URL (TCP for CI migrations, e.g. `postgresql://USER:PASS@HOST:5432/fiberops`) |
| `GCS_BUCKET_IMPORTS` | Yes | Bucket name |
| `GCS_BUCKET_PHOTOS` | Yes | Bucket name |
| `CLOUDSQL_CONNECTION_NAME` | No | `project:region:instance` — if set, backend Cloud Run gets `--add-cloudsql-instances` |

Edit workflow `env` if you want different region, service names, or Artifact Registry repo name.

**Ports**: Backend Cloud Run uses `--port 8080` (Cloud Run sets `PORT`; Express already uses `process.env.PORT`). Frontend uses nginx on **80** (`--port 80`).

### Local Docker build (without Actions)

- `docker build -t fiberops-backend ./backend`
- `docker build -t fiberops-frontend ./frontend`

## Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| DATABASE_URL | backend | PostgreSQL connection string |
| PORT | backend | Server port (default 3000 locally) |
| GCS_BUCKET_IMPORTS | backend | GCS bucket for PRISM imports |
| GCS_BUCKET_PHOTOS | backend | GCS bucket for photos |
| GCP_PROJECT_ID | backend | GCP project ID |
| VITE_API_URL | frontend | API base URL (e.g. `http://localhost:3000`) |
| VITE_MAP_LAT | frontend | Default map latitude |
| VITE_MAP_LNG | frontend | Default map longitude |
| VITE_MAP_ZOOM | frontend | Default map zoom level |
