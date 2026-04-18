"""
Pluggable backup storage backends.

The active backend is selected via the ``BACKUP_STORAGE_BACKEND`` env var:
  * ``local`` (default) — store backup zips on a local directory / docker volume
    (path = ``BACKUPS_DIR``).
  * ``s3``             — store backup zips in an S3-compatible object storage
    (e.g. Hetzner Object Storage shared with family-archive).

S3 backend env vars (required when backend == "s3"):
  BACKUP_S3_ENDPOINT_URL    — e.g. https://fsn1.your-objectstorage.com
  BACKUP_S3_REGION          — e.g. fsn1 (defaults to "us-east-1")
  BACKUP_S3_BUCKET          — bucket name (may be shared with other apps)
  BACKUP_S3_ACCESS_KEY      — access key id
  BACKUP_S3_SECRET_KEY      — secret access key
  BACKUP_S3_PREFIX          — key prefix, defaults to "admin-routine/backups/"
  BACKUP_S3_FORCE_PATH_STYLE — "1" (default) for Hetzner / MinIO style URLs
"""

from __future__ import annotations

import os
from typing import Optional

from .base import BackupStore
from .local import LocalBackupStore

_store_instance: Optional[BackupStore] = None


def _local_dir_getter() -> str:
    # Read lazily so that tests can monkey-patch ``app.api.backups.BACKUPS_DIR``
    # and the local store will pick the new value up on every call.
    import app.api.backups as backups_module  # local import to avoid cycle at import time

    return backups_module.BACKUPS_DIR


def build_store() -> BackupStore:
    backend = os.getenv("BACKUP_STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        # Imported lazily so the optional ``boto3`` dependency is only needed
        # when S3 is actually configured.
        from .s3 import S3BackupStore

        missing = [
            name
            for name in ("BACKUP_S3_BUCKET", "BACKUP_S3_ACCESS_KEY", "BACKUP_S3_SECRET_KEY")
            if not os.getenv(name)
        ]
        if missing:
            raise RuntimeError(
                "BACKUP_STORAGE_BACKEND=s3 but required env vars are missing: "
                + ", ".join(missing)
            )
        return S3BackupStore(
            endpoint_url=os.getenv("BACKUP_S3_ENDPOINT_URL") or None,
            region=os.getenv("BACKUP_S3_REGION", "us-east-1"),
            bucket=os.environ["BACKUP_S3_BUCKET"],
            access_key=os.environ["BACKUP_S3_ACCESS_KEY"],
            secret_key=os.environ["BACKUP_S3_SECRET_KEY"],
            prefix=os.getenv("BACKUP_S3_PREFIX", "admin-routine/backups/"),
            force_path_style=os.getenv("BACKUP_S3_FORCE_PATH_STYLE", "1") == "1",
        )
    if backend != "local":
        raise RuntimeError(f"Unsupported BACKUP_STORAGE_BACKEND: {backend!r}")
    return LocalBackupStore(_local_dir_getter)


def get_store() -> BackupStore:
    """Return the process-wide store, building it on first access."""
    global _store_instance
    if _store_instance is None:
        _store_instance = build_store()
    return _store_instance


def reset_store() -> None:
    """Drop the cached store. Used by tests when env config changes."""
    global _store_instance
    _store_instance = None


__all__ = ["BackupStore", "LocalBackupStore", "build_store", "get_store", "reset_store"]

