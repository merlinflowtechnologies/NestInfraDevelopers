import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, monthLabel, currentMonth } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog } from "../components/common";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";

const FIELDS = (agents) => [
  { name: "name", label: "Team Name", required: true },
  { name: "leader_code", label: "Team Leader", type: "select", options: agents.map((a) => ({ value: a.agent_code, label: `${a.name} (${a.agent_code})` })) },
  { name: "monthly_target", label: "Monthly Target (₹)", type: "number" },
];

export default function Teams() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [teams, setTeams] = useState([]);
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);
  const month = currentMonth();

  const load = () => {
    api.get(`/teams?month=${month}`).then((r) => setTeams(r.data));
    if (isAdmin) api.get("/agents").then((r) => setAgents(r.data));
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (v) => {
    const payload = { name: v.name, leader_code: v.leader_code || "", monthly_target: parseFloat(v.monthly_target) || 0 };
    if (form.initial?.id) {
      await api.put(`/teams/${form.initial.id}`, payload);
      toast.success("Team updated");
    } else {
      await api.post("/teams", payload);
      toast.success("Team created");
    }
    load();
  };

  return (
    <div data-testid="teams-page">
      <PageHeader title="Teams" sub={`Team performance for ${monthLabel(month)}`} testid="teams-header">
        {isAdmin && (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: null })} data-testid="add-team-button">
            <Plus className="mr-1 h-4 w-4" /> Create Team
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md" data-testid={`team-card-${t.name.toLowerCase()}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900">{t.name}</h3>
                <p className="text-xs text-slate-500">Leader: {t.leader_name || "-"}</p>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Edit team" data-testid={`edit-team-${t.id}`} onClick={() => setForm({ open: true, initial: t })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Delete team" className="text-red-600" data-testid={`delete-team-${t.id}`} onClick={() => setDel(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.members?.map((m) => (
                <span key={m.agent_code} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {m.name}
                </span>
              ))}
              {(!t.members || t.members.length === 0) && <span className="text-xs text-slate-400">No members</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Team Sales</p><p className="font-num font-bold text-slate-900">{inr(t.team_sales)}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bookings</p><p className="font-num font-bold text-slate-900">{t.team_bookings}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Collection</p><p className="font-num font-bold text-slate-900">{inr(t.team_collection)}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Commission</p><p className="font-num font-bold text-slate-900">{inr(t.team_commission)}</p></div>
              {t.team_expenses !== undefined && (
                <div className="col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Team Expenses (this month)</p><p className="font-num font-bold text-red-700" data-testid={`team-expenses-${t.id}`}>{inr(t.team_expenses || 0)}</p></div>
              )}
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-semibold text-slate-600"><Target className="h-3.5 w-3.5" /> Monthly Target</span>
                <span className="font-num font-semibold text-slate-900">{inr(t.monthly_target)}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${t.achievement >= 100 ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${Math.min(100, t.achievement)}%` }} />
              </div>
              <p className="mt-1 text-right text-xs font-num font-semibold text-slate-600">{t.achievement}% achieved</p>
            </div>
          </div>
        ))}
      </div>
      {teams.length === 0 && <p className="py-16 text-center text-sm text-slate-400">No teams yet</p>}

      <FormDialog
        open={form.open}
        onOpenChange={(o) => setForm({ open: o, initial: null })}
        title={form.initial ? "Edit Team" : "Create Team"}
        fields={FIELDS(agents)}
        initial={form.initial}
        onSubmit={submit}
        testid="team-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Team"
        message={`Delete team ${del?.name}? Members will be unassigned.`}
        onConfirm={async () => {
          await api.delete(`/teams/${del.id}`);
          toast.success("Team deleted");
          load();
        }}
        testid="team-delete-confirm"
      />
    </div>
  );
}
