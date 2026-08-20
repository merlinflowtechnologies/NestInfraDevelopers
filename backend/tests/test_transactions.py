# Transactions: sales, payments, commission, salary, expenses
import uuid
import pytest

TODAY = "2026-08-20"


def gv(admin, base_url):
    projects = admin.get(f"{base_url}/api/projects").json()
    return next(p for p in projects if p["name"] == "Nest Green Valley")


class TestSalesFlow:
    def test_seeded_sales(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/sales").json()
        assert len(rows) >= 14
        s = rows[0]
        for k in ("project_name", "agent_name", "team_name", "sale_amount", "balance", "status", "agent_commission", "team_commission"):
            assert k in s

    def test_sales_month_filter(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/sales?month=2026-08").json()
        assert len(rows) > 0
        assert all(r["month"] == "2026-08" for r in rows)

    def test_create_sale_updates_inventory_commission_and_payment(self, admin, base_url):
        proj = gv(admin, base_url)
        before_avail, before_booked = proj["available_plots"], proj["booked_plots"]
        plot = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        payload = {
            "date": TODAY, "project_id": proj["id"], "plot_number": plot,
            "customer_name": "TEST_Customer", "customer_mobile": "9000000001",
            "agent_code": "NIA001", "sale_amount": 1000000, "booking_amount": 200000,
            "status": "booked", "booking_mode": "UPI",
        }
        r = admin.post(f"{base_url}/api/sales", json=payload)
        assert r.status_code in (200, 201), r.text
        sale = r.json()
        sid = sale["id"]
        assert sale["month"] == "2026-08"
        assert sale["amount_collected"] == 200000
        assert sale["balance"] == 800000
        assert sale["status"] == "booked"
        # commission: agent 2% (20000) + GV fixed 10000 = 30000; team leader 0.5% = 5000
        assert sale["agent_commission"] == 30000, sale["agent_commission"]
        assert sale["team_commission"] == 5000, sale["team_commission"]
        assert sale["team_name"], "team not resolved from agent"

        # inventory updated
        p2 = gv(admin, base_url)
        assert p2["available_plots"] == before_avail - 1
        assert p2["booked_plots"] == before_booked + 1

        # automatic payment for booking amount
        pays = admin.get(f"{base_url}/api/payments").json()
        auto = [p for p in pays if p["sale_id"] == sid]
        assert len(auto) == 1
        assert auto[0]["amount"] == 200000
        assert auto[0]["reference"] == "Booking amount"

        # duplicate plot rejected
        dup = admin.post(f"{base_url}/api/sales", json=payload)
        assert dup.status_code == 400
        assert "already" in dup.json()["detail"].lower()

        # add payment -> balance reduces
        pr = admin.post(f"{base_url}/api/payments", json={"date": TODAY, "sale_id": sid, "amount": 300000, "mode": "NEFT", "reference": "TEST_P1"})
        assert pr.status_code in (200, 201), pr.text
        s2 = next(s for s in admin.get(f"{base_url}/api/sales").json() if s["id"] == sid)
        assert s2["amount_collected"] == 500000
        assert s2["balance"] == 500000
        assert s2["status"] == "booked"

        # final payment -> flips to sold, inventory booked->sold
        p_before = gv(admin, base_url)
        pr2 = admin.post(f"{base_url}/api/payments", json={"date": TODAY, "sale_id": sid, "amount": 500000, "mode": "Cheque", "reference": "TEST_P2"})
        assert pr2.status_code in (200, 201)
        s3 = next(s for s in admin.get(f"{base_url}/api/sales").json() if s["id"] == sid)
        assert s3["balance"] == 0
        assert s3["status"] == "sold"
        p_after = gv(admin, base_url)
        assert p_after["sold_plots"] == p_before["sold_plots"] + 1
        assert p_after["booked_plots"] == p_before["booked_plots"] - 1

        # commission pay
        cr = admin.post(f"{base_url}/api/commission/pay", json={"sale_id": sid, "who": "agent", "amount": 30000})
        assert cr.status_code == 200, cr.text
        assert cr.json()["agent_commission_paid"] == 30000
        cr2 = admin.post(f"{base_url}/api/commission/pay", json={"sale_id": sid, "who": "agent", "amount": 100})
        assert cr2.status_code == 400

        # cleanup: delete sale restores inventory
        assert admin.delete(f"{base_url}/api/sales/{sid}").status_code == 200
        p_final = gv(admin, base_url)
        assert p_final["available_plots"] == before_avail
        assert p_final["booked_plots"] == before_booked
        assert not any(p["sale_id"] == sid for p in admin.get(f"{base_url}/api/payments").json())

    def test_sale_full_payment_marks_sold(self, admin, base_url):
        proj = gv(admin, base_url)
        plot = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        r = admin.post(f"{base_url}/api/sales", json={
            "date": TODAY, "project_id": proj["id"], "plot_number": plot,
            "customer_name": "TEST_Full", "agent_code": "NIA002",
            "sale_amount": 500000, "booking_amount": 500000, "status": "sold"})
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["balance"] == 0 and d["status"] == "sold"
        admin.delete(f"{base_url}/api/sales/{d['id']}")

    def test_sale_unknown_project(self, admin, base_url):
        r = admin.post(f"{base_url}/api/sales", json={
            "date": TODAY, "project_id": "64b7f9e2c0000000000000aa", "plot_number": "X1",
            "customer_name": "TEST", "agent_code": "NIA001", "sale_amount": 1000})
        assert r.status_code == 404

    def test_agent_cannot_create_sale(self, agent, base_url):
        r = agent.post(f"{base_url}/api/sales", json={
            "date": TODAY, "project_id": "x", "plot_number": "X1",
            "customer_name": "TEST", "agent_code": "NIA001", "sale_amount": 1000})
        assert r.status_code == 403


class TestCommissionRules:
    def test_seeded_rules(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/commission-rules").json()
        assert len(rows) >= 3
        assert all("project_name" in r for r in rows)

    def test_rule_crud(self, admin, base_url):
        r = admin.post(f"{base_url}/api/commission-rules", json={
            "name": "TEST_Rule", "level": "agent", "rule_type": "fixed", "value": 500,
            "basis": "sale_value", "active": False})
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]
        assert r.json()["value"] == 500
        r2 = admin.put(f"{base_url}/api/commission-rules/{rid}", json={
            "name": "TEST_Rule", "level": "agent", "rule_type": "fixed", "value": 900,
            "basis": "sale_value", "active": False})
        assert r2.status_code == 200 and r2.json()["value"] == 900
        assert admin.delete(f"{base_url}/api/commission-rules/{rid}").status_code == 200
        assert not any(x["id"] == rid for x in admin.get(f"{base_url}/api/commission-rules").json())


class TestSalary:
    def test_list_seeded(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/salary?month=2026-08").json()
        assert len(rows) > 0
        for s in rows:
            assert s["net"] == round(s["basic"] + s.get("bonus", 0) - s.get("deduction", 0), 2)

    def test_salary_crud_net_calc(self, admin, base_url):
        r = admin.post(f"{base_url}/api/salary", json={
            "month": "2026-08", "employee": "TEST_Employee", "designation": "Tester",
            "basic": 30000, "bonus": 5000, "deduction": 2000, "payment_status": "pending"})
        assert r.status_code in (200, 201), r.text
        sid = r.json()["id"]
        assert r.json()["net"] == 33000
        rows = admin.get(f"{base_url}/api/salary?month=2026-08").json()
        rec = next(x for x in rows if x["id"] == sid)
        assert rec["net"] == 33000
        r2 = admin.put(f"{base_url}/api/salary/{sid}", json={
            "month": "2026-08", "employee": "TEST_Employee", "basic": 40000, "bonus": 0, "deduction": 1000,
            "payment_status": "paid", "payment_date": "2026-08-31"})
        assert r2.status_code == 200 and r2.json()["net"] == 39000
        assert admin.delete(f"{base_url}/api/salary/{sid}").status_code == 200
        assert not any(x["id"] == sid for x in admin.get(f"{base_url}/api/salary?month=2026-08").json())


class TestExpenses:
    def test_list_seeded(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/expenses?month=2026-08").json()
        assert len(rows) > 0
        assert all("category" in e and "amount" in e for e in rows)

    def test_expense_crud(self, admin, base_url):
        r = admin.post(f"{base_url}/api/expenses", json={
            "date": "2026-08-15", "category": "Google Ads", "description": "TEST_expense",
            "amount": 12345, "mode": "UPI", "paid_by": "Tester"})
        assert r.status_code in (200, 201), r.text
        eid = r.json()["id"]
        assert r.json()["month"] == "2026-08"
        assert r.json()["amount"] == 12345
        rows = admin.get(f"{base_url}/api/expenses?month=2026-08").json()
        assert any(x["id"] == eid for x in rows)
        r2 = admin.put(f"{base_url}/api/expenses/{eid}", json={
            "date": "2026-08-16", "category": "Travel", "description": "TEST_expense", "amount": 500})
        assert r2.status_code == 200 and r2.json()["category"] == "Travel" and r2.json()["amount"] == 500
        assert admin.delete(f"{base_url}/api/expenses/{eid}").status_code == 200
        assert not any(x["id"] == eid for x in admin.get(f"{base_url}/api/expenses?month=2026-08").json())
