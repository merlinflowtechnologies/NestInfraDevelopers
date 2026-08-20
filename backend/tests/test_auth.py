# Auth module: login, me, RBAC, password hashing
import pytest


class TestAuth:
    def test_admin_login(self, admin_creds, anon, base_url):
        r = anon.post(f"{base_url}/api/auth/login", json=admin_creds)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["role"] == "admin"
        assert d["user"]["email"] == admin_creds["identifier"].lower()

    def test_agent_login_by_code(self, agent_creds, anon, base_url):
        r = anon.post(f"{base_url}/api/auth/login", json=agent_creds)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "agent"
        assert d["user"]["agent_code"] == "NIA001"

    def test_login_bad_password(self, admin_creds, anon, base_url):
        r = anon.post(f"{base_url}/api/auth/login", json={"identifier": admin_creds["identifier"], "password": "WrongPass1"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_unknown_user(self, anon, base_url):
        r = anon.post(f"{base_url}/api/auth/login", json={"identifier": "nobody@x.com", "password": "x"})
        assert r.status_code == 401

    def test_me_requires_auth(self, anon, base_url):
        anon.cookies.clear()
        r = anon.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_admin(self, admin, base_url):
        r = admin.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"
        assert "password_hash" not in r.json()

    def test_invalid_token(self, base_url):
        import requests
        r = requests.get(f"{base_url}/api/auth/me", headers={"Authorization": "Bearer abc.def.ghi"})
        assert r.status_code == 401

    def test_login_sets_httponly_cookie(self, admin_creds, anon, base_url):
        """Playbook requirement: httpOnly cookie on login."""
        r = anon.post(f"{base_url}/api/auth/login", json=admin_creds)
        assert r.status_code == 200
        set_cookie = r.headers.get("set-cookie", "")
        assert "access_token" in set_cookie and "HttpOnly" in set_cookie, f"No httpOnly cookie set: {set_cookie!r}"

    def test_bcrypt_hash_format(self):
        import asyncio
        import sys
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        sys.path.insert(0, "/app/backend")
        from database import db

        async def _get():
            return await db.users.find_one({"role": "admin"})

        u = asyncio.run(_get())
        assert u is not None
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]

    def test_brute_force_lockout(self, anon, base_url, admin_creds):
        """Playbook requirement: lockout after 5 failed attempts."""
        codes = []
        for _ in range(6):
            r = anon.post(f"{base_url}/api/auth/login", json={"identifier": admin_creds["identifier"], "password": "BadPass!123"})
            codes.append(r.status_code)
        assert 429 in codes or 423 in codes, f"No lockout after 6 failures, codes={codes}"


class TestRBAC:
    @pytest.mark.parametrize("path", ["/api/salary", "/api/expenses", "/api/accounts/summary?month=2026-08",
                                      "/api/reports/salary", "/api/reports/expenses", "/api/reports/profit-summary"])
    def test_agent_forbidden(self, agent, base_url, path):
        r = agent.get(f"{base_url}{path}")
        assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_agent_sales_scoped(self, agent, base_url):
        r = agent.get(f"{base_url}/api/sales")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0
        assert all(s["agent_code"] == "NIA001" for s in rows)

    def test_agent_cannot_create_project(self, agent, base_url):
        r = agent.post(f"{base_url}/api/projects", json={"name": "TEST_agentproj", "location": "x", "project_type": "plot", "price": 1, "total_plots": 1})
        assert r.status_code == 403

    def test_agent_other_dashboard_denied(self, agent, base_url):
        r = agent.get(f"{base_url}/api/agents/NIA002/dashboard")
        assert r.status_code == 403

    def test_agent_own_dashboard(self, agent, base_url):
        r = agent.get(f"{base_url}/api/agents/NIA001/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_sales", "commission_earned", "commission_pending", "total_collection"):
            assert k in d
        assert d["agent"]["agent_code"] == "NIA001"

    def test_no_mongo_id_leak(self, admin, base_url):
        for p in ["/api/projects", "/api/agents", "/api/teams", "/api/sales", "/api/payments", "/api/commission-rules"]:
            rows = admin.get(f"{base_url}{p}").json()
            assert isinstance(rows, list)
            for row in rows[:5]:
                assert "_id" not in row, p
                assert "id" in row, p
