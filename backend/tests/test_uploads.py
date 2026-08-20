# Bulk upload: preview (errors/duplicates) + confirm import
import io
import uuid


def upload(client, base_url, entity, filename, content):
    files = {"file": (filename, content.encode("utf-8"), "text/csv")}
    headers = {k: v for k, v in client.headers.items() if k.lower() != "content-type"}
    import requests
    return requests.post(f"{base_url}/api/admin/upload/{entity}", files=files, headers=headers)


class TestUploads:
    def test_template_info(self, admin, base_url):
        r = admin.get(f"{base_url}/api/admin/upload/template-info")
        assert r.status_code == 200
        d = r.json()
        assert "expenses" in d["entities"] and "salary" in d["entities"]
        assert "expenses" in d["columns"]

    def test_unknown_entity(self, admin, base_url):
        r = upload(admin, base_url, "widgets", "a.csv", "a,b\n1,2\n")
        assert r.status_code == 404

    def test_agent_cannot_upload(self, agent, base_url):
        r = upload(agent, base_url, "expenses", "a.csv", "date,category,amount\n2026-08-01,Travel,100\n")
        assert r.status_code == 403

    def test_expenses_preview_and_confirm(self, admin, base_url):
        tag = uuid.uuid4().hex[:5]
        csv = (
            "date,category,amount,mode,paid_by\n"
            f"2026-08-05,Marketing,15000,UPI,TEST_{tag}\n"
            f"2026-08-06,Fuel,2500,Cash,TEST_{tag}\n"
            ",Travel,900,Cash,TEST_bad\n"
        )
        r = upload(admin, base_url, "expenses", "exp.csv", csv)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == 3
        assert len(d["errors"]) == 1 and d["errors"][0]["row"] == 4
        assert d["valid"] == 2
        good = [row for row in d["rows"] if row.get("date")]
        cr = admin.post(f"{base_url}/api/admin/upload/expenses/confirm", json={"rows": good})
        assert cr.status_code == 200, cr.text
        assert cr.json()["inserted"] == 2, cr.json()
        assert cr.json()["failed"] == []
        rows = admin.get(f"{base_url}/api/expenses?month=2026-08").json()
        mine = [e for e in rows if e.get("paid_by") == f"TEST_{tag}"]
        assert len(mine) == 2
        assert sum(e["amount"] for e in mine) == 17500
        for e in mine:
            assert admin.delete(f"{base_url}/api/expenses/{e['id']}").status_code == 200

    def test_confirm_rejects_missing_required(self, admin, base_url):
        cr = admin.post(f"{base_url}/api/admin/upload/expenses/confirm",
                        json={"rows": [{"date": "", "category": "Travel", "amount": 100}]})
        assert cr.status_code == 200
        assert cr.json()["inserted"] == 0
        assert len(cr.json()["failed"]) == 1

    def test_salary_duplicate_flagged(self, admin, base_url):
        existing = admin.get(f"{base_url}/api/salary?month=2026-08").json()
        assert existing, "no seeded salary for 2026-08"
        emp = existing[0]["employee"]
        csv = (
            "month,employee,designation,basic,bonus,deduction\n"
            f"2026-08,{emp},Manager,50000,5000,1000\n"
            "2026-08,TEST_NewEmp,Exec,20000,0,0\n"
        )
        r = upload(admin, base_url, "salary", "sal.csv", csv)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["duplicates"]) == 1, d["duplicates"]
        assert d["duplicates"][0]["row"] == 2
        assert d["valid"] == 1

    def test_sales_upload_duplicate_and_missing_project(self, admin, base_url):
        sales = admin.get(f"{base_url}/api/sales").json()
        s = sales[0]
        csv = (
            "date,project,plot_number,customer_name,agent,sale_amount,booking_amount\n"
            f"2026-08-10,{s['project_name']},{s['plot_number']},TEST_Dup,NIA001,1000000,100000\n"
            "2026-08-10,No Such Project,ZZ-1,TEST_X,NIA001,1000000,100000\n"
        )
        r = upload(admin, base_url, "sales", "sales.csv", csv)
        assert r.status_code == 200, r.text
        d = r.json()
        assert any("already sold/booked" in x["message"] for x in d["duplicates"]), d
        assert any("not found" in x["message"] for x in d["errors"]), d
        assert d["valid"] == 0

    def test_projects_upload_flow(self, admin, base_url):
        name = f"TEST_UP_{uuid.uuid4().hex[:5]}"
        csv = (
            "name,location,project_type,price,plot_sizes,total_plots,images,description,map_url\n"
            f"{name},Shamirpet,Open Plots,3000,200;300,5,https://x/a.jpg,desc,https://maps.google.com/?q=1\n"
        )
        r = upload(admin, base_url, "projects", "p.csv", csv)
        assert r.status_code == 200, r.text
        assert r.json()["valid"] == 1 and r.json()["duplicates"] == []
        cr = admin.post(f"{base_url}/api/admin/upload/projects/confirm", json={"rows": r.json()["rows"]})
        assert cr.status_code == 200 and cr.json()["inserted"] == 1
        projects = admin.get(f"{base_url}/api/projects").json()
        p = next(x for x in projects if x["name"] == name)
        assert p["available_plots"] == 5 and p["total_plots"] == 5
        # duplicate flagged on re-preview
        r2 = upload(admin, base_url, "projects", "p.csv", csv)
        assert len(r2.json()["duplicates"]) == 1
        assert admin.delete(f"{base_url}/api/projects/{p['id']}").status_code == 200

    def test_malformed_file(self, admin, base_url):
        import requests
        headers = {k: v for k, v in admin.headers.items() if k.lower() != "content-type"}
        files = {"file": ("bad.xlsx", b"not-an-excel-file", "application/vnd.ms-excel")}
        r = requests.post(f"{base_url}/api/admin/upload/expenses", files=files, headers=headers)
        assert r.status_code == 400, r.status_code
