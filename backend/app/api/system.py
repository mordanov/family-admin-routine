"""
/api/system — disk, memory, docker volumes and containers stats.
Sub-endpoints allow independent refresh of each section.
All Docker SDK calls are guarded: if the socket is not mounted the
endpoint returns an empty list instead of failing.
"""

import asyncio
import os
import shutil
from typing import Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.config import BACKUPS_DIR, SITES

router = APIRouter(prefix="/system", tags=["system"])

# Volume paths we care about (backup dir + all site volumes)
_VOLUME_PATHS: dict[str, str] = {"backups": BACKUPS_DIR}
for site_name, site_cfg in SITES.items():
    for vol in site_cfg.get("volumes", []):
        _VOLUME_PATHS[f"{site_name}/{vol['name']}"] = vol["path"]


# ── helpers ───────────────────────────────────────────────────────────────────

def _du(path: str) -> Optional[int]:
    """Return directory size in bytes, or None if path doesn't exist."""
    try:
        total = 0
        for root, _dirs, files in os.walk(path):
            for fname in files:
                try:
                    total += os.path.getsize(os.path.join(root, fname))
                except OSError:
                    pass
        return total
    except Exception:
        return None


def _disk_info() -> dict:
    try:
        usage = shutil.disk_usage("/")
        return {
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
            "used_percent": round(usage.used / usage.total * 100, 1),
        }
    except Exception:
        return {}


def _ram_info() -> dict:
    try:
        vm = psutil.virtual_memory()
        return {
            "total_bytes": vm.total,
            "used_bytes": vm.used,
            "available_bytes": vm.available,
            "used_percent": round(vm.percent, 1),
        }
    except Exception:
        return {}


def _container_stats() -> list[dict]:
    """Return memory stats for all running containers via Docker socket."""
    try:
        import docker  # noqa — optional dep
        client = docker.from_env(timeout=5)
        results = []
        for container in client.containers.list():
            try:
                stats = container.stats(stream=False)
                mem = stats.get("memory_stats", {})
                usage = mem.get("usage", 0)
                limit = mem.get("limit", 0)
                # Subtract file cache (Linux kernel page cache) for real RSS.
                # `cache` lives in memory_stats.stats.inactive_file for cgroup v2,
                # or memory_stats.stats.cache for cgroup v1.
                cache = (
                    mem.get("stats", {}).get("inactive_file")
                    or mem.get("stats", {}).get("cache")
                    or 0
                )
                rss = max(0, usage - cache)
                results.append(
                    {
                        "name": container.name,
                        "status": container.status,
                        "rss_bytes": rss,
                        "limit_bytes": limit,
                        "used_percent": round(rss / limit * 100, 1) if limit else 0,
                    }
                )
            except Exception:
                pass
        return sorted(results, key=lambda c: c["rss_bytes"], reverse=True)
    except Exception:
        return []


# ── independent sub-endpoints ─────────────────────────────────────────────────

@router.get("/diskram")
async def get_diskram(_user=Depends(get_current_user)):
    loop = asyncio.get_event_loop()
    disk, ram = await asyncio.gather(
        loop.run_in_executor(None, _disk_info),
        loop.run_in_executor(None, _ram_info),
    )
    return {"disk": disk, "ram": ram}


@router.get("/volumes")
async def get_volumes(_user=Depends(get_current_user)):
    loop = asyncio.get_event_loop()
    volumes = {}
    for label, path in _VOLUME_PATHS.items():
        size = await loop.run_in_executor(None, _du, path)
        volumes[label] = {"path": path, "size_bytes": size}
    return {"volumes": volumes}


@router.get("/containers")
async def get_containers(_user=Depends(get_current_user)):
    loop = asyncio.get_event_loop()
    containers = await loop.run_in_executor(None, _container_stats)
    return {"containers": containers}


# ── combined endpoint (fetches all three in parallel) ─────────────────────────

@router.post("/docker-prune")
async def docker_prune(_user=Depends(get_current_user)):
    """Remove all unused Docker images — equivalent to: docker image prune -a -f"""
    loop = asyncio.get_event_loop()

    def _prune():
        try:
            import docker  # noqa — optional dep
            client = docker.from_env(timeout=60)
            result = client.images.prune(filters={"dangling": False})
            deleted = result.get("ImagesDeleted") or []
            return {
                "deleted_count": len([d for d in deleted if "Deleted" in d]),
                "reclaimed_bytes": result.get("SpaceReclaimed", 0),
            }
        except Exception as exc:
            raise RuntimeError(str(exc))

    try:
        return await loop.run_in_executor(None, _prune)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("")
async def system_info(_user=Depends(get_current_user)):
    loop = asyncio.get_event_loop()

    disk_ram_task = asyncio.gather(
        loop.run_in_executor(None, _disk_info),
        loop.run_in_executor(None, _ram_info),
        loop.run_in_executor(None, _container_stats),
    )

    disk, ram, containers = await disk_ram_task

    volumes = {}
    for label, path in _VOLUME_PATHS.items():
        size = await loop.run_in_executor(None, _du, path)
        volumes[label] = {"path": path, "size_bytes": size}

    return {
        "disk": disk,
        "ram": ram,
        "volumes": volumes,
        "containers": containers,
    }
