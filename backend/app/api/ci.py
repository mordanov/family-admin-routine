"""GET /api/ci/runs — last 5 GitHub Actions workflow runs per deployed site."""

import asyncio
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.config import GITHUB_OWNER, GITHUB_REPOS, GITHUB_TOKEN

router = APIRouter(prefix="/ci", tags=["ci"])

_GH_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    **({"Authorization": f"Bearer {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}),
}


def _duration_s(run: dict) -> Optional[int]:
    started = run.get("run_started_at") or run.get("created_at")
    updated = run.get("updated_at")
    if not started or not updated or run.get("status") != "completed":
        return None
    try:
        a = datetime.fromisoformat(started.replace("Z", "+00:00"))
        b = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        return max(0, int((b - a).total_seconds()))
    except Exception:
        return None


async def _fetch_runs(client: httpx.AsyncClient, repo: str) -> list[dict]:
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{repo}/actions/runs"
    try:
        r = await client.get(url, params={"per_page": 5}, headers=_GH_HEADERS, timeout=10)
        r.raise_for_status()
        runs = r.json().get("workflow_runs", [])
        return [
            {
                "id": run["id"],
                "run_number": run["run_number"],
                "name": run.get("name", ""),
                "branch": run.get("head_branch", ""),
                "event": run.get("event", ""),
                "status": run.get("status", ""),
                "conclusion": run.get("conclusion"),
                "created_at": run.get("created_at"),
                "updated_at": run.get("updated_at"),
                "duration_s": _duration_s(run),
                "url": run.get("html_url", ""),
            }
            for run in runs
        ]
    except Exception:
        return []


@router.get("/runs")
async def get_ci_runs(_user=Depends(get_current_user)):
    if not GITHUB_OWNER or not GITHUB_TOKEN:
        return {"configured": False, "sites": {}}

    async with httpx.AsyncClient() as client:
        site_names = list(GITHUB_REPOS.keys())
        results = await asyncio.gather(
            *[_fetch_runs(client, GITHUB_REPOS[s]) for s in site_names]
        )

    return {
        "configured": True,
        "sites": {
            site: {
                "repo": f"{GITHUB_OWNER}/{GITHUB_REPOS[site]}",
                "runs": runs,
            }
            for site, runs in zip(site_names, results)
        },
    }
