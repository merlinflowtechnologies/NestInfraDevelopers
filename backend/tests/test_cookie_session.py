"""Iteration 3: cookie-session auth regression + report shape spot-checks."""
import os

import pytest
import requests
from pymongo import MongoClient


class TestCookieSession:
    """Cookie-only auth (no Bearer header) must work end-to-end."""

    def test_cookie_only_me_and_logout(self, base_url, admin_creds):
        s = requests.Session()
        r = s.post(f"{base_url}/api/auth/login", json=admin_creds, timeout=60)
        assert r.status_code == 200, r.text[:300]
        sc = r.headers.get("set-cookie", "")
        assert "access_token=" in sc and "HttpOnly" in sc, sc
        assert "Secure" in sc and "amesite=none" in sc.lower(), sc
        assert s.cookies.get("access_token"), "cookie not stored by client"

        # cookie-only (no Authorization header)
        me = s.get(f"{base_url}/api/auth/me", timeout=60)
        assert me.status_code == 200, me.text[:300]
        body = me.json()
        assert body.get("role") == "admin"
        assert "password_hash" not in body
        assert "_id" in body and isinstance(body["_id"], str)

        out = s.post(f"{base_url}/api/auth/logout", timeout=60)
        assert out.status_code == 200
        assert out.json() == {"ok": True}
        # server instructed deletion
        assert not s.cookies.get("access_token"), "cookie still present after logout"

        after = s.get(f"{base_url}/api/auth/me", timeout=60)
        assert after.status_code == 401, f"session not cleared: {after.status_code}"

    def test_logout_requires_auth(self, base_url):
        r = requests.post(f"{base_url}/api/auth/logout", timeout=60)
        assert r.status_code == 401

    def test_agent_cookie_login(self, base_url, agent_creds):
        s = requests.Session()
        r = s.post(f"{base_url}/api/auth/login", json=agent_creds, timeout=60)
        assert r.status_code == 200, r.text[:300]
        me = s.get(f"{base_url}/api/auth/me", timeout=60)
        assert me.status_code == 200
        assert me.json().get("role") == "agent"
        s.post(f"{base_url}/api/auth/logout", timeout=60)

    def test_cors_allows_credentials_explicit_origin(self, base_url, admin_creds):
        """Preflight is answered by the edge proxy, so assert on the app response."""
        origin = base_url
        r = requests.post(
            f"{base_url}/api/auth/login",
            json=admin_creds,
            headers={"Origin": origin, "Content-Type": "application/json"},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("access-control-allow-credentials") == "true"
        allow_origin = r.headers.get("access-control-allow-origin")
        # Public edge may rewrite ACAO; app-level value is asserted separately below.
        assert allow_origin in (origin, "*"), allow_origin
        # App (behind ingress) must echo the explicit origin, not a wildcard.
        local = requests.post(
            "http://localhost:8001/api/auth/login",
            json=admin_creds,
            headers={"Origin": origin, "Content-Type": "application/json"},
            timeout=60,
        )
        assert local.status_code == 200, local.text[:300]
        assert local.headers.get("access-control-allow-credentials") == "true"
        assert local.headers.get("access-control-allow-origin") == origin


class TestPasswordStorage:
    """Playbook: bcrypt $2b$ hashes stored in Mongo."""

    def test_bcrypt_hash_format(self):
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            from dotenv import dotenv_values

            env = dotenv_values("/app/backend/.env")
            mongo_url = mongo_url or env.get("MONGO_URL")
            db_name = db_name or env.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME unavailable")
        client = MongoClient(mongo_url)
        try:
            users = list(client[db_name].users.find({}, {"password_hash": 1}))
            assert users, "no users seeded"
            for u in users:
                assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]
        finally:
            client.close()


class TestReportShapes:
    """Spot-check refactored insights.py report builders return rows."""

    @pytest.mark.parametrize(
        "rtype", ["sales", "agent-sales", "team-sales", "commission", "collections",
                  "projects", "salary", "expenses", "profit-summary"]
    )
    def test_report_returns_rows_list(self, admin, base_url, rtype):
        url = f"{base_url}/api/reports/{rtype}"
        if rtype != "profit-summary":
            url += "?month=2026-08"
        r = admin.get(url, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "rows" in data and isinstance(data["rows"], list)
        for row in data["rows"]:
            assert "_id" not in row

    @pytest.mark.parametrize("fmt", ["csv", "excel"])
    def test_export_downloads(self, admin, base_url, fmt):
        r = admin.get(f"{base_url}/api/reports/sales?month=2026-08&format={fmt}", timeout=90)
        assert r.status_code == 200, r.text[:300]
        assert len(r.content) > 0
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd, cd
        ctype = r.headers.get("content-type", "")
        if fmt == "csv":
            assert "csv" in ctype or "text" in ctype, ctype
        else:
            assert "sheet" in ctype or "excel" in ctype or "octet" in ctype, ctype

    def test_dashboard_shape(self, admin, base_url):
        r = admin.get(f"{base_url}/api/dashboard?month=2026-08", timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data, dict) and data, "empty dashboard payload"
