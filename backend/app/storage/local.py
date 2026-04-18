"""Local filesystem backup store (preserves the original behaviour)."""

from __future__ import annotations

import os
import shutil
from datetime import datetime
from typing import Callable

from fastapi.responses import FileResponse

from .base import BackupStore


class LocalBackupStore(BackupStore):
    backend_name = "local"

    def __init__(self, dir_getter: Callable[[], str]):
        self._dir_getter = dir_getter

    @property
    def dir(self) -> str:
        return self._dir_getter()

    # ── BackupStore API ─────────────────────────────────────────────────────

    def list_backups(self) -> list[dict]:
        directory = self.dir
        os.makedirs(directory, exist_ok=True)
        result: list[dict] = []
        for fname in sorted(os.listdir(directory), reverse=True):
            if not fname.endswith(".zip"):
                continue
            fpath = os.path.join(directory, fname)
            stat = os.stat(fpath)
            # filename format: <site>_YYYYMMDD_HHMMSS.zip
            parts = fname[:-4].rsplit("_", 2)
            site_name = parts[0] if len(parts) == 3 else "unknown"
            result.append(
                {
                    "filename": fname,
                    "site": site_name,
                    "size_bytes": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                }
            )
        return result

    def exists(self, filename: str) -> bool:
        return os.path.isfile(os.path.join(self.dir, filename))

    def save_local_file(self, local_path: str, filename: str) -> None:
        directory = self.dir
        os.makedirs(directory, exist_ok=True)
        target = os.path.join(directory, filename)
        if os.path.abspath(local_path) == os.path.abspath(target):
            return
        shutil.move(local_path, target)

    def fetch_to_local(self, filename: str, target_path: str) -> None:
        src = os.path.join(self.dir, filename)
        if not os.path.isfile(src):
            raise FileNotFoundError(filename)
        shutil.copyfile(src, target_path)

    def delete(self, filename: str) -> None:
        path = os.path.join(self.dir, filename)
        os.remove(path)

    def download_response(self, filename: str):
        path = os.path.join(self.dir, filename)
        return FileResponse(path, media_type="application/zip", filename=filename)

