import pytest


class TestLeads:
    created = []

    def test_seeded_leads(self, admin, base_url):
        r = admin.get(f"{base_url}/api/leads")
        assert r.status_code == 200
        leads = r.json()
        assert len(leads) >= 4
        names = [l["name"] for l in leads]
        assert "Karthik Varma" in names

    def test_lead_crud_and_site_visit(self, admin, base_url):
        payload = {
            "name": "TEST_Ravi Teja",
            "mobile": "9988776655",
            "email": "ravi.t@example.com",
            "budget": 2800000,
            "preferred_plot_size": "200 sq.yds",
            "source": "Website",
            "status": "new",
            "notes": "Interested in East facing plot."
        }
        r = admin.post(f"{base_url}/api/leads", json=payload)
        assert r.status_code in (200, 201), r.text
        lead = r.json()
        lid = lead["id"]
        TestLeads.created.append(lid)
        assert lead["name"] == "TEST_Ravi Teja"

        # Update status
        r = admin.put(f"{base_url}/api/leads/{lid}", json={"status": "contacted"})
        assert r.status_code == 200
        assert r.json()["status"] == "contacted"

        # Add site visit
        visit_payload = {
            "visit_date": "2026-09-10 11:00 AM",
            "assigned_agent": "Rajesh Kumar",
            "notes": "Direct site pickup.",
            "status": "scheduled"
        }
        r = admin.post(f"{base_url}/api/leads/{lid}/site-visits", json=visit_payload)
        assert r.status_code == 200
        updated = r.json()
        assert updated["status"] == "site_visit_scheduled"
        assert len(updated["site_visits"]) >= 1

        # Delete lead
        r = admin.delete(f"{base_url}/api/leads/{lid}")
        assert r.status_code == 200
