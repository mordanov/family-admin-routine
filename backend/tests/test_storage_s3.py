"""
Tests for the S3 backup store and end-to-end backup flow against a mocked S3.

Uses moto's in-memory S3 server. No real network or AWS account needed.
"""

import io
import json
import os
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

import boto3
import pytest
from moto import mock_aws

from app import storage as storage_module
from app.storage.s3 import S3BackupStore

BUCKET = "test-bucket"
PREFIX = "admin-routine/backups/"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def s3_env(monkeypatch):
    """Configure env vars for the S3 backend and stand up a mocked bucket."""
    monkeypatch.setenv("BACKUP_STORAGE_BACKEND", "s3")
    monkeypatch.setenv("BACKUP_S3_ENDPOINT_URL", "")  # use AWS-style mock
    monkeypatch.setenv("BACKUP_S3_REGION", "us-east-1")
    monkeypatch.setenv("BACKUP_S3_BUCKET", BUCKET)
    monkeypatch.setenv("BACKUP_S3_ACCESS_KEY", "test-access")
    monkeypatch.setenv("BACKUP_S3_SECRET_KEY", "test-secret")
    monkeypatch.setenv("BACKUP_S3_PREFIX", PREFIX)
    monkeypatch.setenv("BACKUP_S3_FORCE_PATH_STYLE", "1")

    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        storage_module.reset_store()
        yield client
        storage_module.reset_store()


def _put_zip(client, filename, *, site="reminders-app"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "metadata.json",
            json.dumps(
                {
                    "site": site,
                    "db_name": site.replace("-", "_"),
                    "db_host": "recipes-db",
                    "volumes": [],
                    "created_at": "2026-01-01T12:00:00Z",
                }
            ),
        )
        zf.writestr("db.dump", b"PGDMP fake")
    client.put_object(Bucket=BUCKET, Key=PREFIX + filename, Body=buf.getvalue())


# ── Unit tests for S3BackupStore ──────────────────────────────────────────────

def test_s3_store_lists_only_zip_files_with_correct_metadata(s3_env):
    _put_zip(s3_env, "reminders-app_20260101_120000.zip")
    _put_zip(s3_env, "poetry-site_20260201_080000.zip", site="poetry-site")
    # noise: non-zip + nested key (should be ignored)
    s3_env.put_object(Bucket=BUCKET, Key=PREFIX + "README.txt", Body=b"hi")
    s3_env.put_object(Bucket=BUCKET, Key=PREFIX + "subdir/x.zip", Body=b"x")

    store = storage_module.get_store()
    backups = store.list_backups()

    names = [b["filename"] for b in backups]
    # Sorted by filename reverse — "reminders-app..." > "poetry-site..." alphabetically.
    assert names == [
        "reminders-app_20260101_120000.zip",
        "poetry-site_20260201_080000.zip",
    ]
    assert {b["site"] for b in backups} == {"reminders-app", "poetry-site"}
    assert all(b["size_bytes"] > 0 for b in backups)


def test_s3_store_exists_and_delete(s3_env):
    _put_zip(s3_env, "news-site_20260101_120000.zip", site="news-site")
    store = storage_module.get_store()

    assert store.exists("news-site_20260101_120000.zip") is True
    assert store.exists("ghost.zip") is False

    store.delete("news-site_20260101_120000.zip")
    assert store.exists("news-site_20260101_120000.zip") is False


def test_s3_store_save_local_file_uploads_and_removes_local(s3_env, tmp_path):
    src = tmp_path / "reminders-app_20260301_120000.zip"
    src.write_bytes(b"PK\x03\x04 fake zip")

    store = storage_module.get_store()
    store.save_local_file(str(src), "reminders-app_20260301_120000.zip")

    # Local file consumed
    assert not src.exists()
    # Object exists in bucket
    obj = s3_env.get_object(Bucket=BUCKET, Key=PREFIX + "reminders-app_20260301_120000.zip")
    assert obj["Body"].read() == b"PK\x03\x04 fake zip"
    assert obj["ContentType"] == "application/zip"


def test_s3_store_fetch_to_local_writes_file(s3_env, tmp_path):
    _put_zip(s3_env, "budget-site_20260101_120000.zip", site="budget-site")

    store = storage_module.get_store()
    target = tmp_path / "out.zip"
    store.fetch_to_local("budget-site_20260101_120000.zip", str(target))

    assert target.exists()
    with zipfile.ZipFile(target) as zf:
        assert "metadata.json" in zf.namelist()


def test_s3_store_fetch_missing_raises_filenotfound(s3_env, tmp_path):
    store = storage_module.get_store()
    with pytest.raises(FileNotFoundError):
        store.fetch_to_local("ghost.zip", str(tmp_path / "nope.zip"))


def test_s3_prefix_is_normalised():
    store = S3BackupStore(
        endpoint_url=None,
        region="us-east-1",
        bucket="b",
        access_key="a",
        secret_key="s",
        prefix="/some/path",
        client=MagicMock(),
    )
    assert store.prefix == "some/path/"

    store2 = S3BackupStore(
        endpoint_url=None,
        region="us-east-1",
        bucket="b",
        access_key="a",
        secret_key="s",
        prefix="",
        client=MagicMock(),
    )
    assert store2.prefix == ""


# ── End-to-end API flow against mocked S3 ────────────────────────────────────

@pytest.mark.asyncio
async def test_storage_info_reports_s3_backend(client, auth_headers, s3_env):
    resp = await client.get("/api/backups/storage-info", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["backend"] == "s3"
    assert data["bucket"] == BUCKET
    assert data["prefix"] == PREFIX


@pytest.mark.asyncio
async def test_list_backups_via_api_uses_s3(client, auth_headers, s3_env):
    _put_zip(s3_env, "poetry-site_20260101_120000.zip", site="poetry-site")
    resp = await client.get("/api/backups", headers=auth_headers)
    assert resp.status_code == 200
    backups = resp.json()
    assert len(backups) == 1
    assert backups[0]["filename"] == "poetry-site_20260101_120000.zip"
    assert backups[0]["site"] == "poetry-site"


@pytest.mark.asyncio
async def test_download_backup_via_api_streams_from_s3(client, auth_headers, s3_env):
    _put_zip(s3_env, "news-site_20260101_120000.zip", site="news-site")
    resp = await client.get(
        "/api/backups/news-site_20260101_120000.zip/download",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    # Body should be a real zip
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        assert "metadata.json" in zf.namelist()


@pytest.mark.asyncio
async def test_delete_backup_via_api_removes_from_s3(client, auth_headers, s3_env):
    _put_zip(s3_env, "budget-site_20260101_120000.zip", site="budget-site")
    resp = await client.delete(
        "/api/backups/budget-site_20260101_120000.zip",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    # Object truly gone
    listing = s3_env.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX)
    assert listing.get("KeyCount", 0) == 0


@pytest.mark.asyncio
async def test_create_backup_uploads_zip_to_s3(client, auth_headers, s3_env):
    """The full backup pipeline writes the zip to S3, not to disk."""
    fake_proc = AsyncMock()
    fake_proc.returncode = 0
    fake_proc.communicate = AsyncMock(return_value=(b"", b""))

    async def _fake_subprocess(*args, **kwargs):
        # pg_dump's -f flag tells us where to write — emit a placeholder file.
        if "pg_dump" in args:
            try:
                idx = args.index("-f")
                with open(args[idx + 1], "wb") as f:
                    f.write(b"PGDMP fake dump")
            except (ValueError, IndexError):
                pass
        return fake_proc

    with patch("asyncio.create_subprocess_exec", side_effect=_fake_subprocess):
        resp = await client.post(
            "/api/backups/create",
            json={"site": "reminders-app"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        job_id = resp.json()["job_id"]

        # Poll until the background task finishes (it runs inline in tests).
        for _ in range(50):
            status = await client.get(f"/api/backups/status/{job_id}", headers=auth_headers)
            payload = status.json()
            if payload["status"] in ("done", "failed"):
                break
        assert payload["status"] == "done", payload

    listing = s3_env.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX)
    keys = [o["Key"] for o in listing.get("Contents", [])]
    assert len(keys) == 1
    assert keys[0].startswith(PREFIX + "reminders-app_")
    assert keys[0].endswith(".zip")


@pytest.mark.asyncio
async def test_build_store_raises_when_required_env_missing(monkeypatch):
    monkeypatch.setenv("BACKUP_STORAGE_BACKEND", "s3")
    monkeypatch.delenv("BACKUP_S3_BUCKET", raising=False)
    monkeypatch.delenv("BACKUP_S3_ACCESS_KEY", raising=False)
    monkeypatch.delenv("BACKUP_S3_SECRET_KEY", raising=False)
    storage_module.reset_store()
    with pytest.raises(RuntimeError, match="BACKUP_S3_"):
        storage_module.build_store()


