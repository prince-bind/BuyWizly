import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ.update(DATABASE_URL=f"sqlite:///{_tmp}/test.db", VECTOR_BACKEND="memory", GROQ_API_KEY="",
                  RATE_LIMIT_PER_MIN="1000", ENV="dev", ADMIN_EMAILS="admin@test.com")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _auth(client, email, password="ShopSmart123!"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def demo(client):
    return _auth(client, "demo@shopsmart.ai")


@pytest.fixture(scope="session")
def admin(client):
    r = client.post("/api/auth/register", json={
        "name": "Test Admin", "email": "admin@test.com", "password": "AdminPassword123"
    })
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def fresh(client):
    """A brand-new Basic user (isolated cart/orders)."""
    import uuid
    email = f"u{uuid.uuid4().hex[:8]}@test.com"
    r = client.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "Password123"})
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
