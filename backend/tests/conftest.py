import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
frontend_env = dotenv_values(ROOT_DIR / "frontend" / ".env") if (ROOT_DIR / "frontend" / ".env").exists() else {}
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL") or "http://localhost:8000"
BASE_URL = base_url.rstrip("/")


def _creds():
    p = ROOT_DIR / "memory" / "test_credentials.md"
    if p.exists():
        content = p.read_text(encoding="utf-8")
        email = re.search(r"(?im)^\s*[-*]?\s*Email:\s*(\S+)", content)
        pwd = re.search(r"(?im)^\s*[-*]?\s*Password:\s*(\S+)", content)
        if email and pwd:
            return email.group(1), pwd.group(1)
    return os.environ.get("ADMIN_EMAIL", "nestinfradevelopers39@gmail.com"), os.environ.get("ADMIN_PASSWORD", "Admin@123")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def admin_creds():
    email, pwd = _creds()
    return {"identifier": email, "password": pwd}


@pytest.fixture(scope="session")
def agent_creds():
    return {"identifier": "NIA001", "password": "nest@123"}


def _client(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=60)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("No token in login response")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def admin(admin_creds):
    return _client(admin_creds)


@pytest.fixture(scope="session")
def agent(agent_creds):
    return _client(agent_creds)


@pytest.fixture(scope="session")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
