import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-admin-routine-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
REMEMBER_ME_EXPIRE_DAYS = 30

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
    "family-archive": {
        "db_host": os.getenv("ARCHIVE_DB_HOST", "recipes-db"),
        "db_name_env": "ARCHIVE_POSTGRES_DB",
        "db_user_env": "ARCHIVE_POSTGRES_USER",
        "db_pass_env": "ARCHIVE_POSTGRES_PASSWORD",
        "volumes": [
            {"name": "thumbnails", "path": "/mnt/archive_thumbnails"},
        ],
    },
}

# GitHub Actions CI panel
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_OWNER = os.getenv("GITHUB_OWNER", "")

# Path to the YAML file listing repos to show in the CI panel.
# Mount it as a read-only volume: ./ci-repos.yaml:/etc/admin-routine/ci-repos.yaml:ro
CI_REPOS_FILE = os.getenv("CI_REPOS_FILE", "/etc/admin-routine/ci-repos.yaml")
