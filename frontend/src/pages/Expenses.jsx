import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, fdate, monthLabel, currentMonth } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable, StatCard, inputCls } from "../components/common";
import { Button } from "../components/ui/button";

const CATEGORIES = ["Office Rent", "Marketing", "Google Ads", "Meta Ads", "Travel", "Fuel", "Electricity", "Internet", "Salary", "Commission", "Printing", "Other"];
const MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];

export default function Expenses() {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);

  const load = useCallback(() => {
    api.get(`/expenses${month ? `?month=${month}` : ""}`).then((r) => setRows(r.data));
    api.get("/projects").then((r) => setProjects(r.data));
    api.get("/teams").then((r) => setTeams(r.data));
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const isMarketing = (r) => ["Marketing", "Google Ads", "Meta Ads"].includes(r.category);
  const marketing = rows.filter(isMarketing).reduce((s, r) => s + r.amount, 0);
  const projectExp = rows.filter((r) => r.project_id && !isMarketing(r)).reduce((s, r) => s + r.amount, 0);
  const other = rows.filter((r) => !r.project_id && !isMarketing(r)).reduce((s, r) => s + r.amount, 0);

  const fields = [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "category", label: "Category", type: "select", required: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
    { name: "amount", label: "Amount (₹)", type: "number", required: true },
    { name: "mode", label: "Payment Mode", type: "select", options: MODES.map((m) => ({ value: m, label: m })) },
    { name: "project_id", label: "Project (optional)", type: "select", options: projects.map((p) => ({ value: p.id, label: p.name })) },
    { name: "team_id", label: "Team (optional)", type: "select", options: teams.map((t) => ({ value: t.id, label: t.name })) },
    { name: "paid_by", label: "Paid By" },
    { name: "description", label: "Description", type: "textarea", full: true },
  ];

  const submit = async (v) => {
    const payload = {
      date: v.date, category: v.category, amount: parseFloat(v.amount) || 0,
      mode: v.mode || "Cash", project_id: v.project_id || "", team_id: v.team_id || "", paid_by: v.paid_by || "", description: v.description || "",
    };
    if (form.initial?.id) {
      await api.put(`/expenses/${form.initial.id}`, payload);
      toast.success("Expense updated");
    } else {
      await api.post("/expenses", payload);
      toast.success("Expense added");
    }
    load();
  };

  return (
    <div data-testid="expenses-page">
      <PageHeader title="Company Expenses" sub={month ? `Expenses for ${monthLabel(month)}` : "All expenses"} testid="expenses-header">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls + " w-auto"} data-testid="expenses-month-filter" />
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: { date: new Date().toISOString().slice(0, 10) } })} data-testid="add-expense-button">
          <Plus className="mr-1 h-4 w-4" /> Add Expense
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Expenses" value={inr(total)} tone="red" testid="expenses-total" />
        <StatCard label="Marketing" value={inr(marketing)} testid="expenses-marketing" sub="Ads & campaigns" />
        <StatCard label="Project Expenses" value={inr(projectExp)} testid="expenses-project" />
        <StatCard label="Other" value={inr(other)} testid="expenses-other" />
      </div>

      <DataTable
        testid="expenses-table"
        columns={[
          { key: "date", label: "Date", render: (r) => fdate(r.date) },
          { key: "category", label: "Category", render: (r) => (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{r.category}</span>
          )},
          { key: "description", label: "Description", render: (r) => r.description || "-" },
          { key: "project_name", label: "Project", render: (r) => r.project_name || "-" },
          { key: "team_name", label: "Team", render: (r) => r.team_name || "-" },
          { key: "amount", label: "Amount", align: "right", render: (r) => <span className="font-semibold text-red-700">{inr(r.amount)}</span> },
          { key: "mode", label: "Mode" },
          { key: "paid_by", label: "Paid By" },
          { key: "actions", label: "", render: (r) => (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label="Edit expense" data-testid={`edit-expense-${r.id}`} onClick={() => setForm({ open: true, initial: r })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete expense" className="text-red-600" data-testid={`delete-expense-${r.id}`} onClick={() => setDel(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )},
        ]}
        rows={rows}
      />

      <FormDialog
        open={form.open}
        onOpenChange={(o) => setForm({ open: o, initial: null })}
        title={form.initial?.id ? "Edit Expense" : "Add Expense"}
        fields={fields}
        initial={form.initial}
        onSubmit={submit}
        testid="expense-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Expense"
        message={`Delete expense of ${inr(del?.amount)} (${del?.category})?`}
        onConfirm={async () => {
          await api.delete(`/expenses/${del.id}`);
          toast.success("Expense deleted");
          load();
        }}
        testid="expense-delete-confirm"
      />
    </div>
  );
}
