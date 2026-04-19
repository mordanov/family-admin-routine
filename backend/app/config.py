import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-admin-routine-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

BACKUPS_DIR = os.getenv("BACKUPS_DIR", "/app/backups")

# Two users from environment
USERS = {
    os.getenv("ADMIN_USER1_USERNAME", "admin1"): os.getenv("ADMIN_USER1_PASSWORD", ""),
    os.getenv("ADMIN_USER2_USERNAME", "admin2"): os.getenv("ADMIN_USER2_PASSWORD", ""),
}

# Sites to backup.
# db_host: postgres service hostname
# db_name_env / db_user_env / db_pass_env: env var names holding credentials
# volumes: list of {name, path} — path is the mount point inside this container
SITES: dict = {
    "family-kitchen-recipes": {
        "db_host": os.getenv("RECIPES_DB_HOST", "recipes-db"),
        "db_name_env": "RECIPES_POSTGRES_DB",
        "db_user_env": "RECIPES_POSTGRES_USER",
        "db_pass_env": "RECIPES_POSTGRES_PASSWORD",
        "volumes": [
            {"name": "uploads", "path": "/mnt/recipes_uploads"},
            {"name": "documents", "path": "/mnt/recipes_documents"},
        ],
    },
    "poetry-site": {
        "db_host": os.getenv("POETRY_DB_HOST", "recipes-db"),
        "db_name_env": "POETRY_POSTGRES_DB",
        "db_user_env": "POETRY_POSTGRES_USER",
        "db_pass_env": "POETRY_POSTGRES_PASSWORD",
        "volumes": [
            {"name": "uploads", "path": "/mnt/poetry_uploads"},
        ],
    },
    "news-site": {
        "db_host": os.getenv("NEWS_DB_HOST", "recipes-db"),
        "db_name_env": "NEWS_POSTGRES_DB",
        "db_user_env": "NEWS_POSTGRES_USER",
        "db_pass_env": "NEWS_POSTGRES_PASSWORD",
        "volumes": [
            {"name": "photos", "path": "/mnt/news_photos"},
        ],
    },
    "budget-site": {
        "db_host": os.getenv("BUDGET_DB_HOST", "recipes-db"),
        "db_name_env": "BUDGET_POSTGRES_DB",
        "db_user_env": "BUDGET_POSTGRES_USER",
        "db_pass_env": "BUDGET_POSTGRES_PASSWORD",
        "volumes": [
            {"name": "uploads", "path": "/mnt/budget_uploads"},
        ],
    },
    "reminders-app": {
        "db_host": os.getenv("REMINDERS_DB_HOST", "recipes-db"),
        "db_name_env": "REMINDERS_POSTGRES_DB",
        "db_user_env": "REMINDERS_POSTGRES_USER",
        "db_pass_env": "REMINDERS_POSTGRES_PASSWORD",
        "volumes": [],
    },
}

# GitHub Actions CI panel
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_OWNER = os.getenv("GITHUB_OWNER", "")

# Per-site repo name — defaults to the site slug.
# Override individual repos with GITHUB_REPO_<SLUG_UPPER> (dashes → underscores).
GITHUB_REPOS: dict[str, str] = {
    name: os.getenv(f"GITHUB_REPO_{name.upper().replace('-', '_')}", name)
    for name in SITES
}
