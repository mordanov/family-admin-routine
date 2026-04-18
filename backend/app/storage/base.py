"""Abstract backup storage interface."""

from abc import ABC, abstractmethod
from typing import Any


class BackupStore(ABC):
    """All file paths used here refer to the *local* filesystem (temp area).

    The store is responsible for moving bytes between that local path and the
    actual storage backend.
    """

    backend_name: str = "abstract"

    @abstractmethod
    def list_backups(self) -> list[dict]:
        """Return list of backup metadata dicts sorted newest first.

        Each item: ``{filename, site, size_bytes, created_at}``.
        """

    @abstractmethod
    def exists(self, filename: str) -> bool: ...

    @abstractmethod
    def save_local_file(self, local_path: str, filename: str) -> None:
        """Persist a locally-built zip into the store under ``filename``.

        Implementations may delete or move the local file once stored.
        """

    @abstractmethod
    def fetch_to_local(self, filename: str, target_path: str) -> None:
        """Materialise the stored backup at ``target_path`` on local disk."""

    @abstractmethod
    def delete(self, filename: str) -> None: ...

    @abstractmethod
    def download_response(self, filename: str) -> Any:
        """Return a FastAPI response object that streams ``filename``."""

