from app.config import SITES, USERS


REQUIRED_SITE_KEYS = {"db_host", "db_name_env", "db_user_env", "db_pass_env", "volumes"}
REQUIRED_VOLUME_KEYS = {"name", "path"}
EXPECTED_SITES = {
    "family-kitchen-recipes",
    "poetry-site",
    "news-site",
    "budget-site",
    "reminders-app",
}


def test_all_expected_sites_present():
    assert set(SITES.keys()) == EXPECTED_SITES


def test_each_site_has_required_keys():
    for name, cfg in SITES.items():
        missing = REQUIRED_SITE_KEYS - set(cfg.keys())
        assert not missing, f"Site '{name}' is missing keys: {missing}"


def test_volumes_are_lists():
    for name, cfg in SITES.items():
        assert isinstance(cfg["volumes"], list), f"Site '{name}' volumes must be a list"


def test_each_volume_has_required_keys():
    for name, cfg in SITES.items():
        for vol in cfg["volumes"]:
            missing = REQUIRED_VOLUME_KEYS - set(vol.keys())
            assert not missing, f"Volume in '{name}' is missing keys: {missing}"


def test_reminders_has_no_volumes():
    assert SITES["reminders-app"]["volumes"] == []


def test_recipes_has_uploads_and_documents():
    vols = {v["name"] for v in SITES["family-kitchen-recipes"]["volumes"]}
    assert "uploads" in vols
    assert "documents" in vols


def test_users_dict_has_two_entries():
    assert len(USERS) == 2


def test_users_keys_are_strings():
    for k in USERS:
        assert isinstance(k, str)
