import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, fdate } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const LEVELS = ["agent", "team_leader", "project", "team"].map((l) => ({ value: l, label: l.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));

export default function Commission() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [rules, setRules] = useState([]);
  const [sales, setSales] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);
  const [pay, setPay] = useState(null);

  const load = useCallback(() => {
    api.get("/commission-rules").then((r) => setRules(r.data));
    api.get("/sales").then((r) => setSales(r.data.filter((s) => s.status !== "cancelled")));
    api.get("/projects").then((r) => setProjects(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const fields = [
    { name: "name", label: "Rule Name", required: true, placeholder: "Agent Commission 2%" },
    { name: "level", label: "Applies To", type: "select", required: true, options: LEVELS },
    { name: "rule_type", label: "Type", type: "select", required: true, options: [
      { value: "percentage", label: "Percentage (%)" }, { value: "fixed", label: "Fixed Amount (₹)" },
    ]},
    { name: "value", label: "Value", type: "number", required: true },
    { name: "basis", label: "Based On", type: "select", options: [
      { value: "sale_value", label: "Sale Value" }, { value: "collection", label: "Collection" },
    ]},
    { name: "project_id", label: "Project (for project rules)", type: "select", options: projects.map((p) => ({ value: p.id, label: p.name })) },
  ];

  const submit = async (v) => {
    const payload = {
      name: v.name, level: v.level || "agent", rule_type: v.rule_type || "percentage",
      value: parseFloat(v.value) || 0, basis: v.basis || "sale_value", project_id: v.project_id || "",
      active: form.initial ? form.initial.active : true,
    };
    if (form.initial?.id) {
      await api.put(`/commission-rules/${form.initial.id}`, payload);
      toast.success("Rule updated");
    } else {
      await api.post("/commission-rules", payload);
      toast.success("Rule created");
    }
    load();
  };

  const paySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/commission/pay", { sale_id: pay.sale.id, who: pay.who, amount: parseFloat(pay.amount) || 0 });
      toast.success("Commission marked as paid");
      setPay(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div data-testid="commission-page">
      <PageHeader title="Commission" sub="Rules and commission ledger" testid="commission-header">
        {isAdmin && (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: null })} data-testid="add-rule-button">
            <Plus className="mr-1 h-4 w-4" /> Add Rule
          </Button>
        )}
      </PageHeader>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid={`rule-card-${r.id}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display font-semibold text-slate-900">{r.name}</p>
                <p className="mt-0.5 text-xs capitalize text-slate-500">
                  {r.level.replace("_", " ")} · {r.basis === "sale_value" ? "Sale Value" : "Collection"}
                  {r.project_name ? ` · ${r.project_name}` : ""}
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Edit rule" data-testid={`edit-rule-${r.id}`} onClick={() => setForm({ open: true, initial: r })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Delete rule" className="text-red-600" data-testid={`delete-rule-${r.id}`} onClick={() => setDel(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-3 font-num text-2xl font-bold text-emerald-700">
              {r.rule_type === "percentage" ? `${r.value}%` : inr(r.value)}
            </p>
            <button
              className={`mt-2 text-xs font-semibold ${r.active ? "text-emerald-700" : "text-slate-400"}`}
              data-testid={`toggle-rule-${r.id}`}
              onClick={async () => {
                if (!isAdmin) return;
                await api.put(`/commission-rules/${r.id}`, { ...r, active: !r.active });
                load();
              }}
            >
              {r.active ? "● Active" : "○ Inactive"}
            </button>
          </div>
        ))}
        {rules.length === 0 && <p className="py-8 text-sm text-slate-400">No commission rules yet</p>}
      </div>

      <h2 className="mb-3 font-display text-lg font-medium text-slate-800">Commission Ledger</h2>
      <DataTable
        testid="commission-table"
        columns={[
          { key: "date", label: "Date", render: (r) => fdate(r.date) },
          { key: "project_name", label: "Project / Plot", render: (r) => `${r.project_name} · ${r.plot_number}` },
          { key: "agent_name", label: "Agent" },
          { key: "sale_amount", label: "Sale Amount", align: "right", render: (r) => inr(r.sale_amount) },
          { key: "agent_commission", label: "Agent Comm.", align: "right", render: (r) => inr(r.agent_commission) },
          { key: "agent_pending", label: "Agent Pending", align: "right", render: (r) => (
            <span className={r.agent_commission - r.agent_commission_paid > 0 ? "text-amber-700 font-semibold" : "text-emerald-700"}>
              {inr(r.agent_commission - r.agent_commission_paid)}
            </span>
          )},
          { key: "team_commission", label: "Team/Leader Comm.", align: "right", render: (r) => inr(r.team_commission) },
          { key: "team_pending", label: "Team Pending", align: "right", render: (r) => (
            <span className={r.team_commission - r.team_commission_paid > 0 ? "text-amber-700 font-semibold" : "text-emerald-700"}>
              {inr(r.team_commission - r.team_commission_paid)}
            </span>
          )},
          ...((isAdmin || isLead) ? [{ key: "actions", label: "Payout Actions", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" data-testid={`pay-agent-${r.id}`} disabled={r.agent_commission - r.agent_commission_paid <= 0}
                className="text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                onClick={() => setPay({ sale: r, who: "agent", amount: r.agent_commission - r.agent_commission_paid })}>
                Pay Agent
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" data-testid={`pay-team-${r.id}`} disabled={r.team_commission - r.team_commission_paid <= 0}
                  className="text-xs text-purple-700 hover:bg-purple-50 border-purple-300"
                  onClick={() => setPay({ sale: r, who: "team", amount: r.team_commission - r.team_commission_paid })}>
                  Pay Team/Lead
                </Button>
              )}
            </div>
          )}] : []),
        ]}
        rows={sales}
      />

      <Dialog open={!!pay} onOpenChange={() => setPay(null)}>
        <DialogContent className="max-w-sm" data-testid="pay-commission-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Pay {pay?.who === "agent" ? "Agent" : "Team/Leader"} Commission</DialogTitle>
          </DialogHeader>
          {pay && (
            <form onSubmit={paySubmit} className="space-y-4">
              <p className="text-sm text-slate-500">{pay.sale.project_name} · Plot {pay.sale.plot_number} · {pay.sale.agent_name}</p>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount (₹)</Label>
                <Input className="mt-1.5" type="number" step="any" value={pay.amount} data-testid="pay-commission-amount"
                  onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPay(null)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800" data-testid="pay-commission-submit">
                  <IndianRupee className="mr-1 h-4 w-4" /> Mark Paid
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog
        open={form.open}
        onOpenChange={(o) => setForm({ open: o, initial: null })}
        title={form.initial ? "Edit Commission Rule" : "Add Commission Rule"}
        fields={fields}
        initial={form.initial}
        onSubmit={submit}
        testid="rule-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Rule"
        message={`Delete commission rule "${del?.name}"?`}
        onConfirm={async () => {
          await api.delete(`/commission-rules/${del.id}`);
          toast.success("Rule deleted");
          load();
        }}
        testid="rule-delete-confirm"
      />
    </div>
  );
}
