"""
Backup and restore operations for all sites.

Backup structure inside zip:
  metadata.json
  db.dump          (pg_dump custom format)
  files/
    <volume_name>/  (copy of each volume directory)
"""

import asyncio
import json
import os
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.config import BACKUPS_DIR, SITES

router = APIRouter()

# In-memory job tracker: job_id -> {status, message, site, filename}
_jobs: dict = {}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_site(site: str) -> dict:
    if site not in SITES:
        raise HTTPException(status_code=404, detail=f"Unknown site: {site}")
    return SITES[site]


def _resolve_db(site_cfg: dict) -> tuple[str, str, str, str]:
    """Return (host, dbname, user, password)."""
    host = site_cfg["db_host"]
    name = os.getenv(site_cfg["db_name_env"], "")
    user = os.getenv(site_cfg["db_user_env"], "")
    password = os.getenv(site_cfg["db_pass_env"], "")
    return host, name, user, password


def _list_backup_files() -> list[dict]:
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    result = []
    for fname in sorted(os.listdir(BACKUPS_DIR), reverse=True):
        if not fname.endswith(".zip"):
            continue
        fpath = os.path.join(BACKUPS_DIR, fname)
        stat = os.stat(fpath)
        # filename format: <site>_YYYYMMDD_HHMMSS.zip
        parts = fname[:-4].rsplit("_", 2)
        site_name = parts[0] if len(parts) == 3 else "unknown"
        result.append({
            "filename": fname,
            "site": site_name,
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return result


def _last_backup_for_site(site: str) -> Optional[str]:
    prefix = site + "_"
    for b in _list_backup_files():
        if b["filename"].startswith(prefix):
            return b["created_at"]
    return None


# ── Background tasks ─────────────────────────────────────────────────────────

async def _run_backup(job_id: str, site: str):
    _jobs[job_id] = {"status": "running", "message": "Starting backup…", "site": site, "filename": None}
    tmpdir = tempfile.mkdtemp(prefix="admin_backup_")
    try:
        site_cfg = SITES[site]
        host, dbname, user, password = _resolve_db(site_cfg)

        _jobs[job_id]["message"] = "Dumping database…"
        dump_path = os.path.join(tmpdir, "db.dump")
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        proc = await asyncio.create_subprocess_exec(
            "pg_dump",
            "-h", host,
            "-U", user,
            "-d", dbname,
            "-Fc",          # custom compressed format
            "-f", dump_path,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"pg_dump failed: {stderr.decode()}")

        _jobs[job_id]["message"] = "Copying volume files…"
        files_dir = os.path.join(tmpdir, "files")
        os.makedirs(files_dir, exist_ok=True)
        for vol in site_cfg["volumes"]:
            src = vol["path"]
            dst = os.path.join(files_dir, vol["name"])
            if os.path.isdir(src) and os.listdir(src):
                shutil.copytree(src, dst)
            else:
                os.makedirs(dst, exist_ok=True)

        metadata = {
            "site": site,
            "db_name": dbname,
            "db_host": host,
            "volumes": [v["name"] for v in site_cfg["volumes"]],
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        with open(os.path.join(tmpdir, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)

        _jobs[job_id]["message"] = "Compressing archive…"
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{site}_{timestamp}.zip"
        zip_path = os.path.join(BACKUPS_DIR, filename)
        os.makedirs(BACKUPS_DIR, exist_ok=True)
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(tmpdir):
                for file in files:
                    abs_path = os.path.join(root, file)
                    arc_name = os.path.relpath(abs_path, tmpdir)
                    zf.write(abs_path, arc_name)

        _jobs[job_id].update({"status": "done", "message": "Backup complete.", "filename": filename})
    except Exception as exc:
        _jobs[job_id].update({"status": "failed", "message": str(exc)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


async def _run_restore(job_id: str, filename: str):
    _jobs[job_id] = {"status": "running", "message": "Extracting archive…", "site": None, "filename": filename}
    tmpdir = tempfile.mkdtemp(prefix="admin_restore_")
    try:
        zip_path = os.path.join(BACKUPS_DIR, filename)
        if not os.path.isfile(zip_path):
            raise RuntimeError("Backup file not found")

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmpdir)

        meta_path = os.path.join(tmpdir, "metadata.json")
        if not os.path.isfile(meta_path):
            raise RuntimeError("metadata.json missing in archive")
        with open(meta_path) as f:
            metadata = json.load(f)

        site = metadata["site"]
        _jobs[job_id]["site"] = site
        site_cfg = SITES.get(site)
        if not site_cfg:
            raise RuntimeError(f"Unknown site in metadata: {site}")

        host, dbname, user, password = _resolve_db(site_cfg)
        env = os.environ.copy()
        env["PGPASSWORD"] = password

        _jobs[job_id]["message"] = "Restoring database…"
        # Drop existing connections then drop & recreate DB
        admin_user = os.getenv("RECIPES_POSTGRES_USER", user)
        admin_pass = os.getenv("RECIPES_POSTGRES_PASSWORD", password)
        env_admin = os.environ.copy()
        env_admin["PGPASSWORD"] = admin_pass

        drop_sql = (
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='{dbname}' AND pid<>pg_backend_pid();"
            f"DROP DATABASE IF EXISTS {dbname};"
            f"CREATE DATABASE {dbname} OWNER {user};"
            f"GRANT ALL PRIVILEGES ON DATABASE {dbname} TO {user};"
        )
        proc = await asyncio.create_subprocess_exec(
            "psql", "-h", host, "-U", admin_user, "-d", "postgres", "-c", drop_sql,
            env=env_admin,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"DB drop/recreate failed: {stderr.decode()}")

        dump_path = os.path.join(tmpdir, "db.dump")
        if os.path.isfile(dump_path):
            proc = await asyncio.create_subprocess_exec(
                "pg_restore", "-h", host, "-U", user, "-d", dbname, "--no-owner", "--role", user, dump_path,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            # pg_restore may return non-zero even on partial success (warnings); check for real errors
            if proc.returncode not in (0, 1):
                raise RuntimeError(f"pg_restore failed: {stderr.decode()}")

        _jobs[job_id]["message"] = "Restoring files…"
        files_dir = os.path.join(tmpdir, "files")
        for vol in site_cfg["volumes"]:
            src = os.path.join(files_dir, vol["name"])
            dst = vol["path"]
            if os.path.isdir(src):
                os.makedirs(dst, exist_ok=True)
                shutil.copytree(src, dst, dirs_exist_ok=True)

        _jobs[job_id].update({"status": "done", "message": "Restore complete."})
    except Exception as exc:
        _jobs[job_id].update({"status": "failed", "message": str(exc)})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/sites")
async def list_sites(_: str = Depends(get_current_user)):
    return [
        {
            "name": name,
            "last_backup": _last_backup_for_site(name),
            "volumes": [v["name"] for v in cfg["volumes"]],
        }
        for name, cfg in SITES.items()
    ]


@router.get("/backups")
async def list_backups(_: str = Depends(get_current_user)):
    return _list_backup_files()


class CreateBackupRequest(BaseModel):
    site: str


@router.post("/backups/create")
async def create_backup(
    req: CreateBackupRequest,
    background_tasks: BackgroundTasks,
    _: str = Depends(get_current_user),
):
    _get_site(req.site)
    job_id = str(uuid.uuid4())
    background_tasks.add_task(_run_backup, job_id, req.site)
    return {"job_id": job_id}


@router.get("/backups/status/{job_id}")
async def backup_status(job_id: str, _: str = Depends(get_current_user)):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/backups/{filename}/download")
async def download_backup(filename: str, _: str = Depends(get_current_user)):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(BACKUPS_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(path, media_type="application/zip", filename=filename)


@router.post("/backups/{filename}/restore")
async def restore_backup(
    filename: str,
    background_tasks: BackgroundTasks,
    _: str = Depends(get_current_user),
):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(BACKUPS_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")
    job_id = str(uuid.uuid4())
    background_tasks.add_task(_run_restore, job_id, filename)
    return {"job_id": job_id}


@router.delete("/backups/{filename}")
async def delete_backup(filename: str, _: str = Depends(get_current_user)):
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(BACKUPS_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")
    os.remove(path)
    return {"ok": True}
