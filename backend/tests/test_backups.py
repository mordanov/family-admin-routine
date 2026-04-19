"""
Tests for backup/restore endpoints.

pg_dump and pg_restore subprocesses are mocked so no real database is needed.
File operations run in pytest's tmp_path fixture.
"""

import json
import os
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import TEST_USER1


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_fake_process(returncode: int = 0, stderr: bytes = b"") -> MagicMock:
    proc = AsyncMock()
    proc.returncode = returncode
    proc.communicate = AsyncMock(return_value=(b"", stderr))
    return proc


async def _fake_subprocess(*args, **kwargs):
    return _make_fake_process()


def _build_backup_zip(tmp_path, site: str = "reminders-app") -> str:
    """Create a minimal valid backup ZIP and return its filename."""
    from datetime import datetime

    filename = f"{site}_20260101_120000.zip"
    zip_path = tmp_path / filename

    metadata = {
        "site": site,
        "db_name": f"{site.replace('-', '_')}",
        "db_host": "recipes-db",
        "volumes": [],
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("metadata.json", json.dumps(metadata))
        zf.writestr("db.dump", b"PGDMP fake dump data")

    return filename


# ── GET /api/sites ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_sites_returns_all_sites(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/sites", headers=auth_headers)
    assert resp.status_code == 200
    sites = resp.json()
    names = {s["name"] for s in sites}
    assert names == {"family-kitchen-recipes", "poetry-site", "news-site", "budget-site", "reminders-app", "family-archive"}


@pytest.mark.asyncio
async def test_list_sites_unauthenticated(client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/sites")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_sites_includes_volumes_field(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/sites", headers=auth_headers)
    for site in resp.json():
        assert "volumes" in site
        assert isinstance(site["volumes"], list)


@pytest.mark.asyncio
async def test_list_sites_last_backup_none_when_empty(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/sites", headers=auth_headers)
    for site in resp.json():
        assert site["last_backup"] is None


# ── GET /api/backups ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_backups_empty(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/backups", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_backups_unauthenticated(client):
    resp = await client.get("/api/backups")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_backups_shows_created_file(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    filename = _build_backup_zip(tmp_path, "reminders-app")
    resp = await client.get("/api/backups", headers=auth_headers)
    assert resp.status_code == 200
    backups = resp.json()
    assert len(backups) == 1
    assert backups[0]["filename"] == filename
    assert backups[0]["site"] == "reminders-app"
    assert backups[0]["size_bytes"] > 0


@pytest.mark.asyncio
async def test_list_backups_ignores_non_zip_files(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    (tmp_path / "readme.txt").write_text("hello")
    _build_backup_zip(tmp_path, "news-site")
    resp = await client.get("/api/backups", headers=auth_headers)
    assert len(resp.json()) == 1


# ── POST /api/backups/create ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_backup_unknown_site(client, auth_headers):
    resp = await client.post("/api/backups/create", json={"site": "nonexistent"}, headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_backup_unauthenticated(client):
    resp = await client.post("/api/backups/create", json={"site": "reminders-app"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_backup_returns_job_id(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    with patch("asyncio.create_subprocess_exec", side_effect=_fake_subprocess):
        resp = await client.post(
            "/api/backups/create",
            json={"site": "reminders-app"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "job_id" in data
    assert isinstance(data["job_id"], str)
    assert len(data["job_id"]) > 0


# ── GET /api/backups/status/{job_id} ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_job_status_not_found(client, auth_headers):
    resp = await client.get("/api/backups/status/nonexistent-job-id", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_job_status_unauthenticated(client):
    resp = await client.get("/api/backups/status/some-id")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_job_status_exists_after_create(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    with patch("asyncio.create_subprocess_exec", side_effect=_fake_subprocess):
        create_resp = await client.post(
            "/api/backups/create",
            json={"site": "reminders-app"},
            headers=auth_headers,
        )
    job_id = create_resp.json()["job_id"]

    status_resp = await client.get(f"/api/backups/status/{job_id}", headers=auth_headers)
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert data["status"] in ("pending", "running", "done", "failed")
    assert "message" in data


# ── DELETE /api/backups/{filename} ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_backup_not_found(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.delete("/api/backups/ghost.zip", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_backup_unauthenticated(client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.delete("/api/backups/somefile.zip")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_backup_success(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    filename = _build_backup_zip(tmp_path, "reminders-app")

    resp = await client.delete(f"/api/backups/{filename}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert not (tmp_path / filename).exists()


@pytest.mark.asyncio
async def test_delete_backup_path_traversal_rejected(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.delete("/api/backups/..%2Fetc%2Fpasswd", headers=auth_headers)
    assert resp.status_code in (400, 404)


# ── GET /api/backups/{filename}/download ─────────────────────────────────────

@pytest.mark.asyncio
async def test_download_backup_not_found(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/backups/ghost.zip/download", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_download_backup_unauthenticated(client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.get("/api/backups/somefile.zip/download")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_download_backup_success(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    filename = _build_backup_zip(tmp_path, "poetry-site")

    resp = await client.get(f"/api/backups/{filename}/download", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    assert len(resp.content) > 0


# ── POST /api/backups/{filename}/restore ─────────────────────────────────────

@pytest.mark.asyncio
async def test_restore_backup_not_found(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.post("/api/backups/ghost.zip/restore", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_restore_backup_unauthenticated(client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.post("/api/backups/somefile.zip/restore")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_restore_backup_returns_job_id(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    filename = _build_backup_zip(tmp_path, "reminders-app")

    with patch("asyncio.create_subprocess_exec", side_effect=_fake_subprocess):
        resp = await client.post(
            f"/api/backups/{filename}/restore",
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "job_id" in data


@pytest.mark.asyncio
async def test_restore_path_traversal_rejected(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    resp = await client.post("/api/backups/..%2Fetc%2Fpasswd/restore", headers=auth_headers)
    assert resp.status_code in (400, 404)


# ── Health endpoint ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ── last_backup tracking ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_last_backup_shown_after_file_created(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backups.BACKUPS_DIR", str(tmp_path))
    _build_backup_zip(tmp_path, "reminders-app")

    resp = await client.get("/api/sites", headers=auth_headers)
    reminders = next(s for s in resp.json() if s["name"] == "reminders-app")
    assert reminders["last_backup"] is not None
