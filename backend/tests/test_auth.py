import pytest
from jose import jwt

from app.auth import authenticate_user, create_token, get_current_user
from app.config import SECRET_KEY, ALGORITHM
from tests.conftest import TEST_USER1, TEST_PASS1, TEST_USER2, TEST_PASS2


# ── Unit: authenticate_user ───────────────────────────────────────────────────

def test_authenticate_valid_user1():
    assert authenticate_user(TEST_USER1, TEST_PASS1) == TEST_USER1


def test_authenticate_valid_user2():
    assert authenticate_user(TEST_USER2, TEST_PASS2) == TEST_USER2


def test_authenticate_wrong_password():
    assert authenticate_user(TEST_USER1, "wrong") is None


def test_authenticate_unknown_user():
    assert authenticate_user("ghost", TEST_PASS1) is None


def test_authenticate_empty_password():
    assert authenticate_user(TEST_USER1, "") is None


# ── Unit: create_token ────────────────────────────────────────────────────────

def test_create_token_contains_subject():
    token = create_token(TEST_USER1)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == TEST_USER1


def test_create_token_has_expiry():
    token = create_token(TEST_USER1)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert "exp" in payload


def test_create_token_is_string():
    assert isinstance(create_token(TEST_USER1), str)


# ── API: POST /api/auth/login ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client):
    resp = await client.post(
        "/api/auth/login",
        data={"username": TEST_USER1, "password": TEST_PASS1},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_second_user(client):
    resp = await client.post(
        "/api/auth/login",
        data={"username": TEST_USER2, "password": TEST_PASS2},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    resp = await client.post(
        "/api/auth/login",
        data={"username": TEST_USER1, "password": "wrongpass"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user(client):
    resp = await client.post(
        "/api/auth/login",
        data={"username": "nobody", "password": "pass"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_missing_fields(client):
    resp = await client.post("/api/auth/login", data={"username": TEST_USER1})
    assert resp.status_code == 422


# ── API: GET /api/auth/me ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_me_authenticated(client, auth_headers):
    resp = await client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == TEST_USER1


@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_invalid_token(client):
    resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert resp.status_code == 401
