"""GET /api/ci/runs — last 5 GitHub Actions workflow runs per repo.

Repos are read from CI_REPOS_FILE (a YAML file mounted as a volume).
Each entry may override the default GITHUB_OWNER with its own `owner` field.
"""

import os
from datetime import datetime
from typing import Optional

import httpx
import yaml
from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.config import CI_REPOS_FILE, GITHUB_OWNER, GITHUB_TOKEN

router = APIRouter(prefix="/ci", tags=["ci"])


def _load_repos() -> list[dict]:
    """Read repo list from CI_REPOS_FILE. Returns [] if file is missing or invalid."""
    try:
        with open(CI_REPOS_FILE) as f:
            data = yaml.safe_load(f)
        return data.get("repos", []) if isinstance(data, dict) else []
    except Exception:
        return []


def _gh_headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


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


async def _fetch_runs(client: httpx.AsyncClient, owner: str, repo: str) -> list[dict]:
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs"
    try:
        r = await client.get(url, params={"per_page": 5}, headers=_gh_headers(), timeout=10)
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
                "commit_message": (run.get("head_commit") or {}).get("message", "").split("\n")[0],
                "commit_sha": (run.get("head_sha") or "")[:7],
            }
            for run in runs
        ]
    except Exception:
        return []


@router.get("/runs")
async def get_ci_runs(_user=Depends(get_current_user)):
    if not GITHUB_TOKEN or not GITHUB_OWNER:
        return {"configured": False, "repos": []}

    repo_defs = _load_repos()

    async with httpx.AsyncClient() as client:
        import asyncio
        results = await asyncio.gather(
            *[
                _fetch_runs(client, r.get("owner", GITHUB_OWNER), r["repo"])
                for r in repo_defs
            ]
        )

    return {
        "configured": True,
        "repos": [
            {
                "key": f"{r.get('owner', GITHUB_OWNER)}/{r['repo']}",
                "repo": f"{r.get('owner', GITHUB_OWNER)}/{r['repo']}",
                "label": r.get("label", r["repo"]),
                "runs": runs,
            }
            for r, runs in zip(repo_defs, results)
        ],
    }
