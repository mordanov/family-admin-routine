import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app

TEST_USER1 = "admin1"
TEST_PASS1 = "testpass1"
TEST_USER2 = "admin2"
TEST_PASS2 = "testpass2"


@pytest_asyncio.fixture(autouse=True)
async def patch_users(monkeypatch):
    """Replace USERS in auth module with known test credentials for every test."""
    monkeypatch.setattr("app.auth.USERS", {TEST_USER1: TEST_PASS1, TEST_USER2: TEST_PASS2})


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client):
    resp = await client.post(
        "/api/auth/login",
        data={"username": TEST_USER1, "password": TEST_PASS1},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
