# Masters: projects, agents, teams CRUD + seeded data
import pytest


class TestProjects:
    created = []

    def test_seeded_projects(self, admin, base_url):
        r = admin.get(f"{base_url}/api/projects")
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 3
        names = [p["name"] for p in rows]
        for n in ("Nest Green Valley", "Nest Lake View Enclave", "Nest Sunrise County"):
            assert n in names
        p = rows[0]
        for k in ("available_plots", "booked_plots", "sold_plots", "total_plots", "map_url", "images"):
            assert k in p
        for p in rows:
            assert p["available_plots"] + p["booked_plots"] + p["sold_plots"] == p["total_plots"], p["name"]

    def test_project_crud(self, admin, base_url):
        payload = {"name": "TEST_Project_A", "location": "Hyderabad", "project_type": "Open Plots",
                   "price": 2500.0, "plot_sizes": "200-500", "total_plots": 10,
                   "images": ["https://example.com/a.jpg"], "description": "test", "map_url": "https://maps.google.com/?q=x"}
        r = admin.post(f"{base_url}/api/projects", json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        pid = d["id"]
        TestProjects.created.append(pid)
        assert d["available_plots"] == 10 and d["booked_plots"] == 0 and d["sold_plots"] == 0

        got = admin.get(f"{base_url}/api/projects").json()
        assert any(p["id"] == pid and p["name"] == "TEST_Project_A" for p in got)

        # duplicate name rejected
        r2 = admin.post(f"{base_url}/api/projects", json=payload)
        assert r2.status_code == 400

        payload["total_plots"] = 12
        r3 = admin.put(f"{base_url}/api/projects/{pid}", json=payload)
        assert r3.status_code == 200
        assert r3.json()["available_plots"] == 12

        r4 = admin.delete(f"{base_url}/api/projects/{pid}")
        assert r4.status_code == 200
        TestProjects.created.remove(pid)
        got = admin.get(f"{base_url}/api/projects").json()
        assert not any(p["id"] == pid for p in got)

    def test_bad_project_id(self, admin, base_url):
        r = admin.put(f"{base_url}/api/projects/not-an-id", json={"name": "x", "location": "y", "project_type": "z", "price": 1, "total_plots": 1})
        assert r.status_code == 400

    def test_validation_error(self, admin, base_url):
        r = admin.post(f"{base_url}/api/projects", json={"name": "TEST_bad"})
        assert r.status_code == 422


class TestAgentsTeams:
    def test_seeded_agents(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/agents").json()
        codes = [a["agent_code"] for a in rows]
        for i in range(1, 10):
            assert f"NIA00{i}" in codes
        assert all("team_name" in a for a in rows)

    def test_seeded_teams(self, admin, base_url):
        rows = admin.get(f"{base_url}/api/teams?month=2026-08").json()
        assert len(rows) >= 3
        for t in rows:
            for k in ("leader_name", "members", "monthly_target", "achievement", "team_sales", "team_collection", "team_commission"):
                assert k in t, k
            assert isinstance(t["members"], list)
        assert any(t["leader_name"] for t in rows), "No team has a leader name resolved"

    def test_agent_crud(self, admin, base_url):
        payload = {"agent_code": "TST900", "name": "TEST_Agent", "mobile": "9999999999",
                   "designation": "Agent", "status": "active", "password": "nest@123"}
        r = admin.post(f"{base_url}/api/agents", json=payload)
        assert r.status_code in (200, 201), r.text
        aid = r.json()["id"]
        assert r.json()["agent_code"] == "TST900"
        assert "password" not in r.json()

        # duplicate
        assert admin.post(f"{base_url}/api/agents", json=payload).status_code == 400

        # new agent can login
        import requests
        lr = requests.post(f"{base_url}/api/auth/login", json={"identifier": "TST900", "password": "nest@123"})
        assert lr.status_code == 200, lr.text

        payload["name"] = "TEST_Agent_Updated"
        r2 = admin.put(f"{base_url}/api/agents/{aid}", json=payload)
        assert r2.status_code == 200 and r2.json()["name"] == "TEST_Agent_Updated"

        assert admin.delete(f"{base_url}/api/agents/{aid}").status_code == 200
        rows = admin.get(f"{base_url}/api/agents").json()
        assert not any(a["agent_code"] == "TST900" for a in rows)

    def test_team_crud(self, admin, base_url):
        r = admin.post(f"{base_url}/api/teams", json={"name": "TEST_Team", "leader_code": "NIA001", "monthly_target": 1000000})
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]
        assert admin.post(f"{base_url}/api/teams", json={"name": "TEST_Team"}).status_code == 400
        r2 = admin.put(f"{base_url}/api/teams/{tid}", json={"name": "TEST_Team", "leader_code": "NIA001", "monthly_target": 2000000})
        assert r2.status_code == 200 and r2.json()["monthly_target"] == 2000000
        assert admin.delete(f"{base_url}/api/teams/{tid}").status_code == 200

    def test_cannot_delete_agent_with_sales(self, admin, base_url):
        agents = admin.get(f"{base_url}/api/agents").json()
        a = next(x for x in agents if x["agent_code"] == "NIA001")
        r = admin.delete(f"{base_url}/api/agents/{a['id']}")
        assert r.status_code == 400

    def test_cannot_delete_project_with_sales(self, admin, base_url):
        projects = admin.get(f"{base_url}/api/projects").json()
        p = next(x for x in projects if x["name"] == "Nest Green Valley")
        r = admin.delete(f"{base_url}/api/projects/{p['id']}")
        assert r.status_code == 400
