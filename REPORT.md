# family-admin-routine — Report

## What was built

A web application for managing backups of all sites in the **web-folders** stack.  
Stack: **React 18 + Vite** (frontend) / **FastAPI + Python 3.12** (backend).

---

## Sites covered

| Site | Database | Volumes backed up |
|------|----------|-------------------|
| family-kitchen-recipes | `recipes` | uploads, documents |
| poetry-site | `poetry` | uploads |
| news-site | `news` | photos |
| budget-site | `budget` | uploads |
| reminders-app | `reminders` | — (DB only) |

---

## Backup format

Each backup is a single ZIP archive named:

```
<site-name>_<YYYYMMDD_HHMMSS>.zip
```

Contents of the archive:

```
metadata.json          — site name, DB name, volume list, created_at
db.dump                — pg_dump custom format (-Fc), compressed
files/
  uploads/             — copy of each mounted volume directory
  documents/
  photos/
  ...
```

---

## Architecture

### Backend (`backend/`)

| File | Role |
|------|------|
| `app/main.py` | FastAPI app, CORS, health endpoint |
| `app/auth.py` | JWT auth (python-jose), 2 users from env vars |
| `app/config.py` | Site definitions, volume mount paths, env var names |
| `app/api/auth.py` | `POST /api/auth/login`, `GET /api/auth/me` |
| `app/api/backups.py` | All backup/restore endpoints, async background tasks |

**Key decisions:**
- No database — user list lives in env vars; backup list comes from the filesystem.
- Backup and restore run as `asyncio` background tasks; status is tracked in an in-memory dict.
- Frontend polls `/api/backups/status/{job_id}` every 2 s until the job finishes.
- `postgresql-client` system package provides `pg_dump`, `pg_restore`, and `psql` inside the container.

### Frontend (`frontend/`)

| File | Role |
|------|------|
| `src/store/authStore.js` | Zustand auth store, JWT in `localStorage` |
| `src/api/` | axios client with `Authorization` header injection |
| `src/pages/Login.jsx` | Login form |
| `src/pages/Dashboard.jsx` | Sites grid + Backups table, job progress |

Single-page application; all routing is client-side (`react-router-dom`).

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | OAuth2 password form → JWT |
| GET | `/api/auth/me` | Returns current username |
| GET | `/api/sites` | All sites with last backup date |
| GET | `/api/backups` | All backup files (filename, site, size, date) |
| POST | `/api/backups/create` | Start backup `{site}` → `{job_id}` |
| GET | `/api/backups/status/{job_id}` | Poll job (pending / running / done / failed) |
| GET | `/api/backups/{filename}/download` | Download ZIP |
| POST | `/api/backups/{filename}/restore` | Start restore → `{job_id}` |
| DELETE | `/api/backups/{filename}` | Delete backup file |
| GET | `/health` | Health check |

---

## Restore process

1. Extract ZIP to a temp directory.
2. Read `metadata.json` to determine site and DB.
3. Terminate existing connections, drop and recreate the database (`psql` via the superuser).
4. `pg_restore --no-owner` restores all tables, data, and sequences.
5. For each volume in the archive, `shutil.copytree` copies files back to the mounted path.
6. Temp directory is cleaned up regardless of outcome.

> **Warning:** Restore overwrites the current database and replaces volume contents.  
> Always verify the backup before restoring in production.

---

## web-folders integration

### Files added / modified

| Path | Change |
|------|--------|
| `docker-compose.yaml` | Added `admin-routine-backend`, `admin-routine-frontend` services; `admin_routine_backups_data` volume |
| `nginx/start.sh` | Added admin-routine domain vars, `require_var` calls, cert detection block |
| `nginx/templates/admin-routine-http.conf.template` | New |
| `nginx/templates/admin-routine-http-redirect.conf.template` | New |
| `nginx/templates/admin-routine-https.conf.template` | New |
| `.env.example` | Added `ADMIN_ROUTINE_*` vars |
| `issue-certificates.sh` | Added `require_var` + `run_certbot` for admin-routine |

### Volume mounts (in `admin-routine-backend`)

| Container path | Docker volume |
|----------------|---------------|
| `/app/backups` | `admin_routine_backups_data` |
| `/mnt/recipes_uploads` | `recipes_uploads_data` |
| `/mnt/recipes_documents` | `recipes_documents_data` |
| `/mnt/poetry_uploads` | `poetry_uploads_data` |
| `/mnt/news_photos` | `news_photos_data` |
| `/mnt/budget_uploads` | `budget_uploads_data` |

The backend container reads all volumes for backup and writes to them on restore.  
The shared postgres (`recipes-db`) is accessed over the internal Docker network via `pg_dump` / `pg_restore`.

---

## Users

Two users are configured via environment variables (no database required):

```
admin1  /  ADMIN_ROUTINE_USER1_PASSWORD
admin2  /  ADMIN_ROUTINE_USER2_PASSWORD
```

Credentials are set in `.env` (web-folders) using the `ADMIN_ROUTINE_USER1/2_*` variables.  
See `.env.example` in both `family-admin-routine/` and `web-folders/`.

---

## Deployment

### Production (via web-folders)

```bash
cd web-folders
# Add ADMIN_ROUTINE_* vars to .env
docker compose up -d --build admin-routine-backend admin-routine-frontend
# Then reload nginx
docker compose exec nginx nginx -s reload
# Or restart the full stack
docker compose up -d --build
```

### Issuing a TLS certificate

```bash
# Requires ADMIN_ROUTINE_PRIMARY_DOMAIN and ADMIN_ROUTINE_SERVER_NAMES in .env
./issue-certificates.sh
```

nginx will auto-switch to HTTPS when the certificate appears (polls every 300 s).

---

## Notes & assumptions

- **In-memory job tracking** — job statuses reset on backend restart. For long-running backups of large volumes this is acceptable; a persistent queue (Redis, DB) can be added later.
- **pg_restore warnings** — `pg_restore` may return exit code 1 for non-fatal warnings (e.g. "role does not exist"). Exit codes 0 and 1 are both treated as success; only ≥ 2 is an error.
- **Superuser for restore** — the DROP/CREATE DATABASE step uses the `RECIPES_POSTGRES_USER` as the admin account (it owns all databases in the shared postgres). This matches the existing web-folders setup.
- **proxy_read_timeout 3600s** — backup/restore of large datasets can take minutes. The nginx timeout is set to 1 hour to cover the download streaming; the actual work runs in a background task so the HTTP connection returns immediately.
- **No reminders volume** — `reminders-app` has no file uploads, so its backup contains only the database dump.
