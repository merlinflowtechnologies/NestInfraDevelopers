import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, fdate } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable, StatusBadge, inputCls } from "../components/common";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";

export default function Sales() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [sales, setSales] = useState([]);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [month, setMonth] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);

  const load = useCallback(() => {
    let url = "/sales?";
    if (month) url += `month=${month}&`;
    if (projectFilter) url += `project_id=${projectFilter}`;
    api.get(url).then((r) => setSales(r.data));
    api.get("/projects").then((r) => setProjects(r.data));
    if (isAdmin) api.get("/agents").then((r) => setAgents(r.data));
  }, [month, projectFilter, isAdmin]);
  useEffect(() => {
    load();
  }, [load]);

  const fields = [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "project_id", label: "Project", type: "select", required: true, options: projects.map((p) => ({ value: p.id, label: p.name })) },
    { name: "plot_number", label: "Plot Number", required: true, placeholder: "GV-101" },
    { name: "customer_name", label: "Customer Name", required: true },
    { name: "customer_mobile", label: "Customer Mobile" },
    { name: "agent_code", label: "Agent", type: "select", required: true, options: agents.map((a) => ({ value: a.agent_code, label: `${a.name} (${a.agent_code})` })), hint: "Team is auto-assigned from agent" },
    { name: "sale_amount", label: "Sale Amount (₹)", type: "number", required: true },
    { name: "booking_amount", label: "Booking Amount (₹)", type: "number" },
    { name: "amount_collected", label: "Amount Collected (₹)", type: "number", hint: "Defaults to booking amount" },
    { name: "status", label: "Booking Status", type: "select", options: [
      { value: "booked", label: "Booked" }, { value: "sold", label: "Sold" },
    ]},
  ];

  const submit = async (v) => {
    await api.post("/sales", {
      date: v.date, project_id: v.project_id, plot_number: v.plot_number,
      customer_name: v.customer_name, customer_mobile: v.customer_mobile || "",
      agent_code: v.agent_code, sale_amount: parseFloat(v.sale_amount) || 0,
      booking_amount: parseFloat(v.booking_amount) || 0,
      amount_collected: v.amount_collected ? parseFloat(v.amount_collected) : null,
      status: v.status || "booked",
    });
    toast.success("Sale recorded — inventory & commission updated");
    load();
  };

  const updateStatus = async (v) => {
    await api.put(`/sales/${form.initial.id}`, { status: v.status, customer_name: v.customer_name, customer_mobile: v.customer_mobile });
    toast.success("Sale updated");
    load();
  };

  return (
    <div data-testid="sales-page">
      <PageHeader title="Sales" sub="Plot bookings and sales" testid="sales-header">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls + " w-auto"} data-testid="sales-month-filter" />
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={inputCls + " w-auto"} data-testid="sales-project-filter">
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isAdmin && (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: null })} data-testid="add-sale-button">
            <Plus className="mr-1 h-4 w-4" /> New Sale
          </Button>
        )}
      </PageHeader>

      <DataTable
        testid="sales-table"
        columns={[
          { key: "date", label: "Date", render: (r) => fdate(r.date) },
          { key: "project_name", label: "Project" },
          { key: "plot_number", label: "Plot" },
          { key: "customer_name", label: "Customer" },
          { key: "agent_name", label: "Agent" },
          { key: "team_name", label: "Team" },
          { key: "sale_amount", label: "Sale Amount", align: "right", render: (r) => inr(r.sale_amount) },
          { key: "amount_collected", label: "Collected", align: "right", render: (r) => inr(r.amount_collected) },
          { key: "balance", label: "Balance", align: "right", render: (r) => inr(r.balance) },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ...(isAdmin ? [{ key: "actions", label: "", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" aria-label="Edit sale" data-testid={`edit-sale-${r.id}`} onClick={() => setForm({ open: true, initial: r, edit: true })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete sale" className="text-red-600" data-testid={`delete-sale-${r.id}`} onClick={() => setDel(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}] : []),
        ]}
        rows={sales}
      />

      {form.edit ? (
        <FormDialog
          open={form.open}
          onOpenChange={(o) => setForm({ open: o, initial: null })}
          title="Update Sale"
          fields={[
            { name: "customer_name", label: "Customer Name", required: true },
            { name: "customer_mobile", label: "Customer Mobile" },
            { name: "status", label: "Booking Status", type: "select", required: true, options: [
              { value: "booked", label: "Booked" }, { value: "sold", label: "Sold" }, { value: "cancelled", label: "Cancelled" },
            ]},
          ]}
          initial={form.initial}
          onSubmit={updateStatus}
          testid="sale-edit-form"
        />
      ) : (
        <FormDialog
          open={form.open}
          onOpenChange={(o) => setForm({ open: o, initial: null })}
          title="New Sale"
          fields={fields}
          onSubmit={submit}
          submitLabel="Save Sale"
          testid="sale-form"
        />
      )}
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Sale"
        message={`Delete sale of plot ${del?.plot_number} (${del?.customer_name})? Inventory will be reverted.`}
        onConfirm={async () => {
          await api.delete(`/sales/${del.id}`);
          toast.success("Sale deleted");
          load();
        }}
        testid="sale-delete-confirm"
      />
    </div>
  );
}
