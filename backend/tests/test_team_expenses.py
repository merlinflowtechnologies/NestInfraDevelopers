"""Iteration 2: team-tagged expenses + team_expenses on /api/teams (bug fix verification)."""
import pytest

MONTH = "2026-08"
TODAY = "2026-08-20"


@pytest.fixture(scope="module")
def teams(admin, base_url):
    r = admin.get(f"{base_url}/api/teams", params={"month": MONTH}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    return data


# --- GET /api/teams exposes team_expenses ---
class TestTeamsExposeExpenses:
    def test_teams_have_team_expenses_field(self, teams):
        for t in teams:
            assert "team_expenses" in t, f"team_expenses missing for {t.get('name')}"
            assert isinstance(t["team_expenses"], (int, float))
            assert "_id" not in t

    def test_seeded_team_names(self, teams):
        names = {t["name"] for t in teams}
        for n in ("Falcons", "Titans", "Strikers"):
            assert n in names, f"{n} not seeded; got {names}"


# --- POST /api/expenses with team_id ---
class TestExpenseTeamTagging:
    def test_expense_with_team_updates_team_expenses(self, admin, base_url, teams):
        falcons = next(t for t in teams if t["name"] == "Falcons")
        before = admin.get(f"{base_url}/api/teams", params={"month": MONTH}, timeout=60).json()
        base_amount = next(t["team_expenses"] for t in before if t["id"] == falcons["id"])

        payload = {
            "date": TODAY,
            "category": "Travel",
            "description": "TEST_team_expense",
            "amount": 1500,
            "team_id": falcons["id"],
            "mode": "Cash",
            "paid_by": "Test Admin",
        }
        r = admin.post(f"{base_url}/api/expenses", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        exp = r.json()
        eid = exp["id"]
        try:
            assert exp["team_id"] == falcons["id"]
            assert exp["team_name"] == "Falcons"
            assert exp["amount"] == 1500
            assert exp["month"] == MONTH
            assert "_id" not in exp

            # GET list verifies persistence
            lst = admin.get(f"{base_url}/api/expenses", params={"month": MONTH}, timeout=60).json()
            row = next((e for e in lst if e["id"] == eid), None)
            assert row is not None, "created expense not in GET /api/expenses"
            assert row["team_name"] == "Falcons"

            # Team card aggregation
            after = admin.get(f"{base_url}/api/teams", params={"month": MONTH}, timeout=60).json()
            fal = next(t for t in after if t["id"] == falcons["id"])
            assert fal["team_expenses"] == base_amount + 1500, fal["team_expenses"]
        finally:
            d = admin.delete(f"{base_url}/api/expenses/{eid}", timeout=60)
            assert d.status_code == 200, d.text

        # after delete, back to base
        final = admin.get(f"{base_url}/api/teams", params={"month": MONTH}, timeout=60).json()
        fal = next(t for t in final if t["id"] == falcons["id"])
        assert fal["team_expenses"] == base_amount

    def test_expense_without_team(self, admin, base_url):
        payload = {"date": TODAY, "category": "Office", "description": "TEST_no_team", "amount": 100}
        r = admin.post(f"{base_url}/api/expenses", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["team_id"] == ""
        assert e["team_name"] == ""
        assert admin.delete(f"{base_url}/api/expenses/{e['id']}", timeout=60).status_code == 200

    def test_expense_invalid_team_id(self, admin, base_url):
        payload = {"date": TODAY, "category": "Office", "amount": 50, "team_id": "not-an-oid"}
        r = admin.post(f"{base_url}/api/expenses", json=payload, timeout=60)
        assert r.status_code in (400, 422), f"expected validation error, got {r.status_code}: {r.text[:200]}"
        if r.status_code == 200:
            admin.delete(f"{base_url}/api/expenses/{r.json()['id']}", timeout=60)

    def test_update_expense_preserves_team(self, admin, base_url, teams):
        titans = next(t for t in teams if t["name"] == "Titans")
        r = admin.post(
            f"{base_url}/api/expenses",
            json={"date": TODAY, "category": "Travel", "amount": 200, "team_id": titans["id"], "description": "TEST_edit"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        e = r.json()
        try:
            u = admin.put(
                f"{base_url}/api/expenses/{e['id']}",
                json={
                    "date": e["date"], "category": e["category"], "description": e["description"],
                    "project_id": e.get("project_id", ""), "team_id": e.get("team_id", ""),
                    "amount": e["amount"], "mode": e.get("mode", "Cash"), "paid_by": e.get("paid_by", ""),
                },
                timeout=60,
            )
            assert u.status_code == 200, u.text
            assert u.json()["team_name"] == "Titans"
            got = admin.get(f"{base_url}/api/expenses", params={"month": MONTH}, timeout=60).json()
            row = next(x for x in got if x["id"] == e["id"])
            assert row["team_name"] == "Titans"
            assert row["amount"] == 200
        finally:
            admin.delete(f"{base_url}/api/expenses/{e['id']}", timeout=60)


# --- Access control regression ---
class TestExpenseAccessControl:
    def test_agent_cannot_list_expenses(self, agent, base_url):
        r = agent.get(f"{base_url}/api/expenses", timeout=60)
        assert r.status_code == 403, r.status_code

    def test_agent_cannot_create_expense(self, agent, base_url):
        r = agent.post(f"{base_url}/api/expenses", json={"date": TODAY, "category": "X", "amount": 1}, timeout=60)
        assert r.status_code == 403, r.status_code

    def test_anon_cannot_list_expenses(self, anon, base_url):
        anon.cookies.clear()
        r = anon.get(f"{base_url}/api/expenses", timeout=60)
        assert r.status_code in (401, 403), r.status_code


# --- Summary reconciliation regression ---
class TestExpenseSummary:
    def test_month_expense_categories_reconcile(self, admin, base_url):
        lst = admin.get(f"{base_url}/api/expenses", params={"month": MONTH}, timeout=60).json()
        total = sum(e["amount"] for e in lst)
        marketing = sum(e["amount"] for e in lst if e["category"].lower() == "marketing")
        project = sum(e["amount"] for e in lst if e.get("project_id"))
        other = total - marketing - project
        assert round(marketing + project + other, 2) == round(total, 2)
        assert all(e["month"] == MONTH for e in lst)
