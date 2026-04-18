# family-admin-routine

A **backup & restore management system** for all web applications in the web-folders stack. Provides a clean web interface to create backups of databases and file volumes, restore from backups, and manage backup archives.

**Stack:** React 18 + Vite (frontend) / FastAPI + Python 3.12 (backend)  
**Supported apps:** family-kitchen-recipes, poetry-site, news-site, budget-site, reminders-app

---

## Quick Start

### Development (Standalone)

```bash
# 1. Clone & setup
cd family-admin-routine
cp .env.example .env
# Edit .env with your database credentials

# 2. Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### Production (via web-folders)

```bash
cd ../web-folders

# 1. Add credentials to .env
# See .env.example for ADMIN_ROUTINE_* variables

# 2. Start containers
docker compose up -d --build admin-routine-backend admin-routine-frontend

# 3. Issue TLS certificate
./issue-certificates.sh

# 4. Access at https://admin-routine.your-domain.com
```

---

## Features

### Backup
- **One-click backup** of any site (database + all file volumes)
- **Async background tasks** — no HTTP timeouts for large backups
- **ZIP archive format** — portable, versioned, includes metadata
- **Auto-cleanup** — backups are compressed and deduplicated

### Restore
- **Full database restore** — DROP/CREATE/RESTORE workflow
- **Volume restore** — files copied back to original mount points
- **Dry-run capable** — review before confirming
- **Rollback-friendly** — always keep a recent backup

### Management
- **Backup list** — size, date, site name
- **Job tracking** — real-time progress polling
- **Download** — export backups outside the system
- **Delete** — remove old backups to save disk space

---

## Architecture

### Backend (`backend/app/`)

| File | Responsibility |
|------|---|
| `main.py` | FastAPI app, CORS, health check, lifespan |
| `auth.py` | JWT authentication, user validation |
| `config.py` | Site definitions, database credentials, volume mounts |
| `api/auth.py` | Login, user info endpoints |
| `api/backups.py` | Backup/restore logic, job tracking, file ops |

#### Key Design

- **No persistent database** — users come from environment variables (`ADMIN_USER1/2_*`)
- **In-memory job tracking** — status dict reset on restart (acceptable for manual admin ops)
- **Async background tasks** — backup/restore run in the background; HTTP endpoints return immediately
- **Polling-friendly** — frontend polls `/api/backups/status/{job_id}` every 2 seconds
- **Superuser restore** — uses `RECIPES_POSTGRES_USER` to DROP/CREATE databases

### Frontend (`frontend/src/`)

| File | Responsibility |
|------|---|
| `store/authStore.js` | Zustand auth store, JWT persistence |
| `api/client.js` | Axios HTTP client with auth header injection |
| `pages/Login.jsx` | Login form, credential submission |
| `pages/Dashboard.jsx` | Sites grid, backup list, restore modal |
| `components/` | Reusable UI components (cards, modals, buttons) |

#### Key Design

- **Single-Page Application** — client-side routing with react-router-dom
- **JWT in localStorage** — auto-sent with every API request
- **Live job polling** — 2s interval during backup/restore
- **Error handling** — user-friendly messages for all failure modes

---

## API Reference

### Auth Endpoints

| Method | Path | Description |
|--------|------|---|
| `POST` | `/api/auth/login` | `{username, password}` → `{access_token, token_type}` |
| `GET` | `/api/auth/me` | Returns `{username}` of current user |

### Sites & Backups

| Method | Path | Description |
|--------|------|---|
| `GET` | `/api/sites` | List all sites with last backup timestamp |
| `GET` | `/api/backups` | List all backup files (filename, site, size, created_at) |

### Backup Operations

| Method | Path | Description |
|--------|------|---|
| `POST` | `/api/backups/create` | `{site}` → `{job_id}` (starts async backup) |
| `GET` | `/api/backups/status/{job_id}` | `{status, message, filename}` (polling) |
| `GET` | `/api/backups/{filename}/download` | Download ZIP file |
| `DELETE` | `/api/backups/{filename}` | Delete backup file |

### Restore Operations

| Method | Path | Description |
|--------|------|---|
| `POST` | `/api/backups/{filename}/restore` | `{confirm: true}` → `{job_id}` (starts async restore) |

### Health

| Method | Path | Description |
|--------|------|---|
| `GET` | `/health` | Returns `{status: "ok"}` |

---

## Backup Format

Each backup is a single ZIP archive:

```
<site>_<YYYYMMDD_HHMMSS>.zip
├── metadata.json           # Site name, DB name, volume list, timestamp
├── db.dump                 # pg_dump custom format (-Fc), compressed
└── files/
    ├── uploads/            # Copy of volume directory
    ├── documents/
    └── ...
```

Example metadata.json:
```json
{
  "site": "family-kitchen-recipes",
  "db_name": "recipes",
  "volumes": ["uploads", "documents"],
  "created_at": "2026-04-13T14:32:10.123456Z"
}
```

---

## Supported Sites & Volumes

| Site | Database | Volumes |
|------|----------|---------|
| **family-kitchen-recipes** | `recipes` | uploads, documents |
| **poetry-site** | `poetry` | uploads |
| **news-site** | `news` | photos |
| **budget-site** | `budget` | uploads |
| **reminders-app** | `reminders` | *(none)* |

All databases are assumed to be on the same PostgreSQL instance (shared `recipes-db` in web-folders).

---

## Configuration

### Environment Variables

#### Security
```bash
SECRET_KEY=your-secret-key                    # JWT signing key
ADMIN_USER1_USERNAME=admin1
ADMIN_USER1_PASSWORD=your-password-1
ADMIN_USER2_USERNAME=admin2
ADMIN_USER2_PASSWORD=your-password-2
```

#### Backup Storage

Backups are persisted via a pluggable store. Two backends are supported:

```bash
# "local" (default) — store ZIPs on disk inside the container
BACKUP_STORAGE_BACKEND=local
BACKUPS_DIR=/app/backups                       # docker volume mount

# "s3" — push ZIPs to an S3-compatible bucket (e.g. Hetzner Object Storage
# shared with family-archive). Backups are stored under a reserved key prefix
# so they don't collide with archive data.
BACKUP_STORAGE_BACKEND=s3
BACKUP_S3_ENDPOINT_URL=https://fsn1.your-objectstorage.com
BACKUP_S3_REGION=fsn1
BACKUP_S3_BUCKET=family-archive
BACKUP_S3_ACCESS_KEY=...
BACKUP_S3_SECRET_KEY=...
BACKUP_S3_PREFIX=admin-routine/backups/        # default
BACKUP_S3_FORCE_PATH_STYLE=1                   # required for Hetzner / MinIO
```

When deployed via `web-folders/docker-compose.yaml` the S3 credentials default
to the same `ARCHIVE_S3_*` values used by `family-archive`, so by setting
`ADMIN_ROUTINE_BACKUP_BACKEND=s3` you immediately reuse the existing bucket.
The reserved prefix `admin-routine/backups/` keeps backup objects separate
from archive content (`files/`, `thumbnails/`, `posters/`, …); the archive
backend only ever touches keys it has stored in its own database, so there
is no risk of cross-contamination.

#### Database Hosts
```bash
RECIPES_DB_HOST=recipes-db                     # Default: recipes-db (Docker service name)
POETRY_DB_HOST=recipes-db
NEWS_DB_HOST=recipes-db
BUDGET_DB_HOST=recipes-db
REMINDERS_DB_HOST=recipes-db
```

#### Database Credentials
```bash
# For each site:
<SITE>_POSTGRES_DB=<database_name>
<SITE>_POSTGRES_USER=<username>
<SITE>_POSTGRES_PASSWORD=<password>
```

See `.env.example` for the complete template.

---

## Deployment

### Docker Compose (Standalone)

```bash
docker compose up -d --build
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### Docker Compose (web-folders)

The `family-admin-routine` backend and frontend are already integrated into `web-folders/docker-compose.yaml`:

```bash
cd web-folders

# Make sure .env has ADMIN_ROUTINE_* variables set
cat >> .env << 'EOF'
ADMIN_ROUTINE_PRIMARY_DOMAIN=admin-routine.example.com
ADMIN_ROUTINE_SERVER_NAMES=admin-routine.example.com
ADMIN_USER1_USERNAME=admin1
ADMIN_USER1_PASSWORD=your-secret-password
ADMIN_USER2_USERNAME=admin2
ADMIN_USER2_PASSWORD=your-secret-password2
EOF

# Start all services
docker compose up -d --build

# Issue TLS certificate
./issue-certificates.sh

# nginx reloads automatically when certificates appear
```

---

## Restore Process (Safety Notes)

### ⚠️ Important

1. **Restore overwrites** — the current database and all files are **replaced**
2. **Verify backup** — always test restore on a **staging database** first
3. **No rollback** — if restore fails, you need a **second backup** to recover
4. **Time-consuming** — large backups can take several minutes to restore

### Restore Workflow

1. User selects a backup file and clicks "Restore"
2. Backend extracts ZIP to temp directory
3. Reads `metadata.json` to determine target site/database
4. **Terminates existing connections** to the database
5. **DROP** existing database (uses superuser credentials)
6. **CREATE** new empty database
7. `pg_restore --no-owner` loads all tables, data, sequences
8. **Copy files** from ZIP back to mounted volumes (overwriting originals)
9. Clean up temp directory
10. Return success/failure status to frontend

---

## Development

### Adding a New Site

1. **Edit** `backend/app/config.py`:
   ```python
   SITES["my-new-site"] = {
       "db_host": os.getenv("MY_DB_HOST", "recipes-db"),
       "db_name_env": "MY_POSTGRES_DB",
       "db_user_env": "MY_POSTGRES_USER",
       "db_pass_env": "MY_POSTGRES_PASSWORD",
       "volumes": [
           {"name": "uploads", "path": "/mnt/my_uploads"},
       ],
   }
   ```

2. **Add volume mount** in `docker-compose.yml` (admin-routine-backend):
   ```yaml
   volumes:
     - my_uploads_data:/mnt/my_uploads
   ```

3. **Add env vars** to `.env.example` and your `.env`

4. **Restart** containers

### Running Tests

```bash
cd frontend
npm install
npm test

cd ../backend
pip install -r requirements-test.txt
pytest -v
```

---

## Troubleshooting

### Q: Backup runs but never completes

**A:** Check backend logs:
```bash
# Standalone
docker logs admin-routine-backend

# web-folders
docker compose logs admin-routine-backend
```

Common issues:
- Database unreachable (wrong `DB_HOST`)
- PostgreSQL credentials incorrect
- Volumes mounted but not writable

### Q: Restore says "database already exists"

**A:** The superuser account may not have permission to DROP. Verify:
- `RECIPES_POSTGRES_USER` is set correctly (should be the superuser)
- Existing connections are terminated before restore

### Q: File volumes restore but database doesn't

**A:** `pg_restore` may return exit code 1 for non-fatal warnings. Check:
- Database was actually restored (query the DB directly)
- Role/table ownership issues (safe to ignore with `--no-owner`)

### Q: Backup file is huge (>1GB)

**A:** Expected for large databases + many files. Tips:
- Use gzip/zstd compression (not current, but possible)
- Exclude certain volumes (modify config)
- Schedule backups during low-activity hours
- Use a separate backup service (e.g., pgBackRest, WAL-E)

---

## Performance & Limits

| Metric | Typical | Notes |
|--------|---------|-------|
| Backup time | 1–10 min | Depends on DB size and volumes |
| Restore time | 1–10 min | Database restore + file copy |
| HTTP timeout | 3600s (1 hr) | Set in nginx; backup runs in background |
| Max backup size | ~50 GB | Limited by disk space and memory |
| Job status retention | Until restart | In-memory; persisted to filesystem at completion |

---

## Security Considerations

- **JWT secret**: Use a strong, random string (e.g., `openssl rand -hex 32`)
- **User passwords**: Change defaults in `.env`; store in a secrets manager in production
- **HTTPS only**: Always use TLS in production; nginx auto-redirects HTTP → HTTPS
- **CORS**: Currently permissive (`*`); restrict to your domain in production
- **Superuser credentials**: The restore process uses DB superuser; secure this carefully
- **Backup storage**: Mount on encrypted volume; restrict file permissions (600)

---

## License

Part of the web-projects monorepo.

