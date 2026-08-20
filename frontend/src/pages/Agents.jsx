import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, fdate, monthLabel, currentMonth } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable, StatusBadge } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const FIELDS = (teams) => [
  { name: "agent_code", label: "Agent ID", required: true, placeholder: "NIA010" },
  { name: "name", label: "Agent Name", required: true },
  { name: "mobile", label: "Mobile Number", required: true },
  { name: "team_id", label: "Team", type: "select", options: teams.map((t) => ({ value: t.id, label: t.name })) },
  { name: "designation", label: "Designation", type: "select", options: [
    { value: "Team Leader", label: "Team Leader" }, { value: "Senior Sales Executive", label: "Senior Sales Executive" },
    { value: "Sales Executive", label: "Sales Executive" }, { value: "Manager", label: "Manager" },
  ]},
  { name: "joining_date", label: "Joining Date", type: "date" },
  { name: "commission_plan", label: "Commission Plan", placeholder: "Standard 2%" },
  { name: "status", label: "Status", type: "select", options: [
    { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
  ]},
  { name: "password", label: "Login Password", placeholder: "Default: nest@123", hint: "Agent logs in with Agent ID + this password" },
];

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);
  const [dash, setDash] = useState(null);

  const load = useCallback(() => {
    api.get("/agents").then((r) => setAgents(r.data));
    api.get("/teams").then((r) => setTeams(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view) api.get(`/agents/${view.agent_code}/dashboard?month=${currentMonth()}`).then((r) => setDash(r.data));
  }, [view]);

  const submit = async (v) => {
    const payload = {
      agent_code: v.agent_code, name: v.name, mobile: v.mobile, team_id: v.team_id || "",
      designation: v.designation || "", joining_date: v.joining_date || "",
      commission_plan: v.commission_plan || "", status: v.status || "active", password: v.password || "",
    };
    if (form.initial?.id) {
      await api.put(`/agents/${form.initial.id}`, payload);
      toast.success("Agent updated");
    } else {
      await api.post("/agents", payload);
      toast.success(`Agent created — login ID ${v.agent_code.toUpperCase()}`);
    }
    load();
  };

  return (
    <div data-testid="agents-page">
      <PageHeader title="Agents" sub="Sales agents and their performance" testid="agents-header">
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: null })} data-testid="add-agent-button">
          <Plus className="mr-1 h-4 w-4" /> Add Agent
        </Button>
      </PageHeader>

      <DataTable
        testid="agents-table"
        columns={[
          { key: "agent_code", label: "ID", render: (r) => <span className="font-num font-semibold">{r.agent_code}</span> },
          { key: "name", label: "Name" },
          { key: "mobile", label: "Mobile" },
          { key: "team_name", label: "Team", render: (r) => r.team_name || "-" },
          { key: "designation", label: "Designation" },
          { key: "joining_date", label: "Joining", render: (r) => fdate(r.joining_date) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "actions", label: "", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" aria-label="View agent" data-testid={`view-agent-${r.agent_code}`} onClick={() => { setView(r); setDash(null); }}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Edit agent" data-testid={`edit-agent-${r.agent_code}`} onClick={() => setForm({ open: true, initial: { ...r, password: "" } })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete agent" className="text-red-600" data-testid={`delete-agent-${r.agent_code}`} onClick={() => setDel(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )},
        ]}
        rows={agents}
        onRowClick={(r) => { setView(r); setDash(null); }}
      />

      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="agent-dashboard-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {view?.name} <span className="font-num text-sm text-slate-400">({view?.agent_code})</span>
            </DialogTitle>
          </DialogHeader>
          {!dash ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">{[...Array(6)].map((_, i) => <div key={`skel-${i}`} className="h-16 rounded-md bg-slate-100" />)}</div>
          ) : (
            <>
              <p className="text-xs text-slate-400">Monthly figures for {monthLabel(dash.month)}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Total Sales", inr(dash.total_sales)],
                  ["Monthly Sales", inr(dash.monthly_sales)],
                  ["Total Bookings", dash.total_bookings],
                  ["Total Collection", inr(dash.total_collection)],
                  ["Commission Earned", inr(dash.commission_earned)],
                  ["Commission Paid", inr(dash.commission_paid)],
                  ["Commission Pending", inr(dash.commission_pending)],
                  ["Monthly Collection", inr(dash.monthly_collection)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{l}</p>
                    <p className="mt-1 font-num text-sm font-bold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>
              <h3 className="mt-4 font-display text-sm font-semibold text-slate-700">Recent Sales</h3>
              <DataTable
                testid="agent-sales-table"
                columns={[
                  { key: "date", label: "Date", render: (r) => fdate(r.date) },
                  { key: "project_name", label: "Project" },
                  { key: "plot_number", label: "Plot" },
                  { key: "sale_amount", label: "Amount", align: "right", render: (r) => inr(r.sale_amount) },
                  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
                ]}
                rows={dash.recent_sales || []}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog
        open={form.open}
        onOpenChange={(o) => setForm({ open: o, initial: null })}
        title={form.initial ? "Edit Agent" : "Add Agent"}
        fields={FIELDS(teams)}
        initial={form.initial}
        onSubmit={submit}
        testid="agent-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Agent"
        message={`Delete agent ${del?.name} (${del?.agent_code})?`}
        onConfirm={async () => {
          await api.delete(`/agents/${del.id}`);
          toast.success("Agent deleted");
          load();
        }}
        testid="agent-delete-confirm"
      />
    </div>
  );
}
