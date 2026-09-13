import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr, fdate, currentMonth } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable, StatCard, inputCls } from "../components/common";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import PaymentReceiptModal from "../components/PaymentReceiptModal";

const MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"].map((m) => ({ value: m, label: m }));

export default function Payments() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [payments, setPayments] = useState([]);
  const [sales, setSales] = useState([]);
  const [month, setMonth] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [del, setDel] = useState(null);
  const [receiptModal, setReceiptModal] = useState({ open: false, paymentId: null });

  const load = useCallback(() => {
    api.get(`/payments${month ? `?month=${month}` : ""}`).then((r) => setPayments(r.data));
    api.get("/sales").then((r) => setSales(r.data.filter((s) => s.status !== "cancelled")));
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const monthTotal = payments.filter((p) => p.month === currentMonth()).reduce((s, p) => s + p.amount, 0);
  const pending = sales.reduce((s, x) => s + (x.balance || 0), 0);

  const fields = [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "sale_id", label: "Booking (Customer / Plot)", type: "select", required: true,
      options: sales.map((s) => ({ value: s.id, label: `${s.customer_name} — ${s.project_name} ${s.plot_number} (Bal: ${inr(s.balance)})` })) },
    { name: "amount", label: "Amount (₹)", type: "number", required: true },
    { name: "mode", label: "Payment Mode", type: "select", options: MODES },
    { name: "reference", label: "Reference / UTR" },
    { name: "received_by", label: "Received By" },
  ];

  return (
    <div data-testid="payments-page">
      <PageHeader title="Payments & Collections" sub="Customer payment receipts" testid="payments-header">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls + " w-auto"} data-testid="payments-month-filter" />
        {isAdmin && (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setFormOpen(true)} data-testid="add-payment-button">
            <Plus className="mr-1 h-4 w-4" /> Add Payment
          </Button>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Collection" value={inr(total)} testid="payments-total" sub={month ? "Filtered view" : "All time"} />
        <StatCard label="This Month" value={inr(monthTotal)} tone="green" testid="payments-month-total" />
        <StatCard label="Pending Collection" value={inr(pending)} tone="amber" testid="payments-pending" sub="Outstanding on active bookings" />
      </div>

      <DataTable
        testid="payments-table"
        columns={[
          { key: "date", label: "Date", render: (r) => fdate(r.date) },
          { key: "customer_name", label: "Customer" },
          { key: "project_name", label: "Project" },
          { key: "plot_number", label: "Plot", render: (r) => <span className="font-bold">#{r.plot_number}</span> },
          { key: "amount", label: "Amount", align: "right", render: (r) => inr(r.amount) },
          { key: "mode", label: "Mode" },
          { key: "reference", label: "Reference", render: (r) => r.reference || "-" },
          { key: "received_by", label: "Received By" },
          {
            key: "actions",
            label: "Receipt / Actions",
            align: "right",
            render: (r) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs text-slate-700 hover:bg-slate-100"
                  onClick={() => setReceiptModal({ open: true, paymentId: r.id })}
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-600" /> Receipt
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete payment"
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    data-testid={`delete-payment-${r.id}`}
                    onClick={() => setDel(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        rows={payments}
      />

      <PaymentReceiptModal
        paymentId={receiptModal.paymentId}
        open={receiptModal.open}
        onOpenChange={(open) => setReceiptModal({ open, paymentId: null })}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Add Payment"
        fields={fields}
        onSubmit={async (v) => {
          await api.post("/payments", {
            date: v.date, sale_id: v.sale_id, amount: parseFloat(v.amount) || 0,
            mode: v.mode || "UPI", reference: v.reference || "", received_by: v.received_by || "",
          });
          toast.success("Payment recorded");
          load();
        }}
        submitLabel="Save Payment"
        testid="payment-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Payment"
        message={`Delete payment of ${inr(del?.amount)} from ${del?.customer_name}? Sale balance will be updated.`}
        onConfirm={async () => {
          await api.delete(`/payments/${del.id}`);
          toast.success("Payment deleted");
          load();
        }}
        testid="payment-delete-confirm"
      />
    </div>
  );
}
