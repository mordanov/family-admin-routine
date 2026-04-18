"""S3-compatible backup store (Hetzner Object Storage, MinIO, AWS S3, ...)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi.responses import StreamingResponse

from .base import BackupStore


class S3BackupStore(BackupStore):
    backend_name = "s3"

    def __init__(
        self,
        *,
        endpoint_url: str | None,
        region: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        prefix: str = "admin-routine/backups/",
        force_path_style: bool = True,
        client=None,
    ):
        self.bucket = bucket
        # Normalise prefix: never leading "/"; always trailing "/" (or empty).
        prefix = (prefix or "").lstrip("/")
        self.prefix = (prefix.rstrip("/") + "/") if prefix else ""
        self._client = client or boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path" if force_path_style else "auto"},
            ),
        )

    # ── helpers ─────────────────────────────────────────────────────────────

    def _key(self, filename: str) -> str:
        return f"{self.prefix}{filename}"

    @staticmethod
    def _site_from_filename(fname: str) -> str:
        parts = fname[:-4].rsplit("_", 2) if fname.endswith(".zip") else fname.rsplit("_", 2)
        return parts[0] if len(parts) == 3 else "unknown"

    # ── BackupStore API ─────────────────────────────────────────────────────

    def list_backups(self) -> list[dict]:
        result: list[dict] = []
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=self.prefix):
            for obj in page.get("Contents") or []:
                key = obj["Key"]
                if not key.startswith(self.prefix):
                    continue
                fname = key[len(self.prefix):]
                # Skip nested "subdirectories" and non-zip files.
                if "/" in fname or not fname.endswith(".zip"):
                    continue
                last_modified = obj["LastModified"]
                if isinstance(last_modified, datetime):
                    if last_modified.tzinfo is not None:
                        last_modified = last_modified.astimezone(timezone.utc).replace(tzinfo=None)
                    created_iso = last_modified.isoformat()
                else:
                    created_iso = str(last_modified)
                result.append(
                    {
                        "filename": fname,
                        "site": self._site_from_filename(fname),
                        "size_bytes": int(obj.get("Size", 0)),
                        "created_at": created_iso,
                    }
                )
        # Filenames embed YYYYMMDD_HHMMSS so lexical reverse sort == newest first.
        result.sort(key=lambda b: b["filename"], reverse=True)
        return result

    def exists(self, filename: str) -> bool:
        try:
            self._client.head_object(Bucket=self.bucket, Key=self._key(filename))
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code in ("404", "NoSuchKey", "NotFound") or status == 404:
                return False
            raise

    def save_local_file(self, local_path: str, filename: str) -> None:
        self._client.upload_file(
            local_path,
            self.bucket,
            self._key(filename),
            ExtraArgs={"ContentType": "application/zip"},
        )
        # Keep the local working dir clean — the canonical copy now lives in S3.
        try:
            os.remove(local_path)
        except OSError:
            pass

    def fetch_to_local(self, filename: str, target_path: str) -> None:
        os.makedirs(os.path.dirname(target_path) or ".", exist_ok=True)
        try:
            self._client.download_file(self.bucket, self._key(filename), target_path)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey", "NotFound"):
                raise FileNotFoundError(filename) from exc
            raise

    def delete(self, filename: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=self._key(filename))

    def download_response(self, filename: str):
        obj = self._client.get_object(Bucket=self.bucket, Key=self._key(filename))
        body = obj["Body"]
        size = obj.get("ContentLength")

        def _iter():
            try:
                for chunk in body.iter_chunks(chunk_size=64 * 1024):
                    if chunk:
                        yield chunk
            finally:
                body.close()

        headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
        if size is not None:
            headers["Content-Length"] = str(size)
        return StreamingResponse(_iter(), media_type="application/zip", headers=headers)

