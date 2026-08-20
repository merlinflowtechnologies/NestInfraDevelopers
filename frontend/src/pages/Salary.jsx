import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, monthLabel, currentMonth, fdate } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable, StatusBadge, StatCard, inputCls } from "../components/common";
import { Button } from "../components/ui/button";

const FIELDS = [
  { name: "month", label: "Month", type: "month", required: true },
  { name: "employee", label: "Employee Name", required: true },
  { name: "agent_code", label: "Agent ID (optional)", placeholder: "NIA001" },
  { name: "designation", label: "Designation" },
  { name: "basic", label: "Basic Salary (₹)", type: "number", required: true },
  { name: "bonus", label: "Bonus (₹)", type: "number" },
  { name: "deduction", label: "Deduction (₹)", type: "number" },
  { name: "payment_status", label: "Payment Status", type: "select", options: [
    { value: "pending", label: "Pending" }, { value: "paid", label: "Paid" },
  ]},
  { name: "payment_date", label: "Payment Date", type: "date" },
];

export default function Salary() {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);

  const load = () => api.get(`/salary${month ? `?month=${month}` : ""}`).then((r) => setRows(r.data));
  useEffect(() => {
    load();
  }, [month]);

  const total = rows.reduce((s, r) => s + (r.net || 0), 0);

  const submit = async (v) => {
    const payload = {
      month: v.month, employee: v.employee, agent_code: v.agent_code || "", designation: v.designation || "",
      basic: parseFloat(v.basic) || 0, bonus: parseFloat(v.bonus) || 0, deduction: parseFloat(v.deduction) || 0,
      payment_status: v.payment_status || "pending", payment_date: v.payment_date || "",
    };
    if (form.initial?.id) {
      await api.put(`/salary/${form.initial.id}`, payload);
      toast.success("Salary updated");
    } else {
      await api.post("/salary", payload);
      toast.success("Salary added");
    }
    load();
  };

  return (
    <div data-testid="salary-page">
      <PageHeader title="Monthly Salary" sub={month ? `Salary sheet for ${monthLabel(month)}` : "All salary records"} testid="salary-header">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls + " w-auto"} data-testid="salary-month-filter" />
        <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: { month: month || currentMonth() } })} data-testid="add-salary-button">
          <Plus className="mr-1 h-4 w-4" /> Add Salary
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Monthly Salary Total" value={inr(total)} testid="salary-total" />
        <StatCard label="Paid" value={inr(rows.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.net, 0))} tone="green" testid="salary-paid" />
        <StatCard label="Pending" value={inr(rows.filter((r) => r.payment_status !== "paid").reduce((s, r) => s + r.net, 0))} tone="amber" testid="salary-pending" />
      </div>

      <DataTable
        testid="salary-table"
        columns={[
          { key: "employee", label: "Employee" },
          { key: "designation", label: "Designation" },
          { key: "basic", label: "Basic", align: "right", render: (r) => inr(r.basic) },
          { key: "bonus", label: "Bonus", align: "right", render: (r) => inr(r.bonus) },
          { key: "deduction", label: "Deduction", align: "right", render: (r) => inr(r.deduction) },
          { key: "net", label: "Net Salary", align: "right", render: (r) => <span className="font-semibold">{inr(r.net)}</span> },
          { key: "payment_status", label: "Status", render: (r) => <StatusBadge status={r.payment_status} /> },
          { key: "payment_date", label: "Paid On", render: (r) => fdate(r.payment_date) },
          { key: "actions", label: "", render: (r) => (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label="Edit salary" data-testid={`edit-salary-${r.id}`} onClick={() => setForm({ open: true, initial: r })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete salary" className="text-red-600" data-testid={`delete-salary-${r.id}`} onClick={() => setDel(r)}>
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
        title={form.initial ? "Edit Salary" : "Add Salary"}
        fields={FIELDS}
        initial={form.initial}
        onSubmit={submit}
        testid="salary-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Salary"
        message={`Delete salary record for ${del?.employee} (${del?.month})?`}
        onConfirm={async () => {
          await api.delete(`/salary/${del.id}`);
          toast.success("Salary deleted");
          load();
        }}
        testid="salary-delete-confirm"
      />
    </div>
  );
}
