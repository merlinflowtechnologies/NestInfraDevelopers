# Insights: dashboard, accounts summary, reports (json/csv/xlsx)
import io
import pytest

MONTH = "2026-08"
REPORTS = ["sales", "agent-sales", "team-sales", "commission", "salary", "expenses",
           "collections", "projects", "profit-summary"]


class TestDashboard:
    def test_admin_dashboard(self, admin, base_url):
        r = admin.get(f"{base_url}/api/dashboard?month={MONTH}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["month"] == MONTH and d["role"] == "admin"
        inv = d["inventory"]
        assert inv["total_projects"] >= 3
        assert inv["available_plots"] + inv["booked_plots"] + inv["sold_plots"] == inv["total_plots"]
        for k in ("monthly_sales", "monthly_collection", "monthly_commission", "total_sales",
                  "total_collection", "total_bookings", "monthly_salary", "monthly_expenses",
                  "estimated_profit", "top_agents", "top_teams", "chart", "recent_sales", "recent_payments"):
            assert k in d, k
        assert d["monthly_sales"] > 0
        assert len(d["chart"]) == 6
        assert d["chart"][-1]["month"] == MONTH, f"chart last month {d['chart'][-1]['month']} != current {MONTH}"
        assert len(d["top_agents"]) > 0 and len(d["top_teams"]) > 0
        assert d["estimated_profit"] == d["monthly_collection"] - d["monthly_commission"] - d["monthly_salary"] - d["monthly_expenses"]

    def test_agent_dashboard_scoped(self, agent, admin, base_url):
        a = agent.get(f"{base_url}/api/dashboard?month={MONTH}").json()
        assert a["role"] == "agent"
        assert "monthly_salary" not in a and "monthly_expenses" not in a
        assert "top_agents" not in a
        adm = admin.get(f"{base_url}/api/dashboard?month={MONTH}").json()
        assert a["total_sales"] < adm["total_sales"]
        assert all(s["agent_code"] == "NIA001" for s in a["recent_sales"])


class TestAccounts:
    def test_accounts_summary(self, admin, base_url):
        r = admin.get(f"{base_url}/api/accounts/summary?month={MONTH}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_sales", "total_collections", "total_commission", "total_salaries",
                  "total_expenses", "total_outstanding", "estimated_profit"):
            assert k in d, k
        assert d["total_sales"] > 0
        assert d["total_collections"] > 0
        assert d["total_salaries"] > 0
        assert d["total_expenses"] > 0
        assert d["estimated_profit"] == d["total_collections"] - d["total_commission"] - d["total_salaries"] - d["total_expenses"]

    def test_accounts_month_required(self, admin, base_url):
        r = admin.get(f"{base_url}/api/accounts/summary")
        assert r.status_code == 422


class TestReports:
    @pytest.mark.parametrize("rtype", REPORTS)
    def test_report_json(self, admin, base_url, rtype):
        r = admin.get(f"{base_url}/api/reports/{rtype}?month={MONTH}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "rows" in d and "count" in d
        assert d["count"] == len(d["rows"])
        if rtype != "profit-summary":
            assert d["count"] > 0, f"{rtype} returned 0 rows for {MONTH}"

    def test_profit_summary_rows(self, admin, base_url):
        d = admin.get(f"{base_url}/api/reports/profit-summary").json()
        assert d["count"] > 0
        row = d["rows"][0]
        for k in ("Month", "Sales", "Collections", "Commission", "Salaries", "Expenses", "Outstanding", "Estimated Profit"):
            assert k in row, k

    def test_unknown_report(self, admin, base_url):
        r = admin.get(f"{base_url}/api/reports/nope")
        assert r.status_code == 404

    def test_csv_export(self, admin, base_url):
        r = admin.get(f"{base_url}/api/reports/sales?month={MONTH}&format=csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]
        assert "attachment" in r.headers.get("content-disposition", "")
        assert "Sale Amount" in r.text.splitlines()[0]

    def test_xlsx_export(self, admin, base_url):
        r = admin.get(f"{base_url}/api/reports/sales?month={MONTH}&format=xlsx")
        assert r.status_code == 200, r.text[:300]
        assert "spreadsheet" in r.headers["content-type"]
        assert r.content[:2] == b"PK"

    def test_empty_report_export_does_not_500(self, admin, base_url):
        r = admin.get(f"{base_url}/api/reports/sales?month=1999-01&format=csv")
        assert r.status_code == 200, r.text[:300]
        r2 = admin.get(f"{base_url}/api/reports/sales?month=1999-01&format=xlsx")
        assert r2.status_code == 200, r2.text[:300]

    def test_agent_report_scoped(self, agent, base_url):
        d = agent.get(f"{base_url}/api/reports/sales").json()
        assert d["count"] > 0
        assert all(row["Agent"] for row in d["rows"])
        adm_codes = {row["Agent"] for row in d["rows"]}
        assert len(adm_codes) == 1, adm_codes
