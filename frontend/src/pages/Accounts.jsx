import { useEffect, useState } from "react";
import api from "../lib/api";
import { inr, monthLabel, currentMonth } from "../lib/format";
import { PageHeader, inputCls } from "../components/common";

const ROWS = [
  ["total_sales", "Total Sales", "text-slate-900"],
  ["total_collections", "Total Collections", "text-emerald-700"],
  ["total_commission", "Total Commission", "text-amber-700"],
  ["total_salaries", "Total Salaries", "text-slate-900"],
  ["total_expenses", "Total Company Expenses", "text-red-700"],
  ["total_outstanding", "Total Outstanding", "text-amber-700"],
];

export default function Accounts() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/accounts/summary?month=${month}`).then((r) => setData(r.data)).catch(() => {});
  }, [month]);

  return (
    <div data-testid="accounts-page">
      <PageHeader title="Monthly Accounts" sub="Simple financial summary per month" testid="accounts-header">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls + " w-auto"} data-testid="accounts-month-picker" />
      </PageHeader>

      {!data ? (
        <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
      ) : (
        <div className="max-w-2xl rounded-lg border border-slate-200 bg-white shadow-sm" data-testid="accounts-summary">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-xl font-semibold text-slate-900">{monthLabel(data.month)}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {ROWS.map(([key, label, cls]) => (
              <div key={key} className="flex items-center justify-between px-6 py-4">
                <p className="text-sm font-medium text-slate-600">{label}</p>
                <p className={`font-num text-lg font-bold ${cls}`} data-testid={`accounts-${key}`}>{inr(data[key])}</p>
              </div>
            ))}
            <div className={`flex items-center justify-between px-6 py-5 ${data.estimated_profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <p className="font-display text-base font-semibold text-slate-900">Estimated Profit</p>
              <p className={`font-num text-2xl font-bold ${data.estimated_profit >= 0 ? "text-emerald-700" : "text-red-700"}`} data-testid="accounts-profit">
                {inr(data.estimated_profit)}
              </p>
            </div>
          </div>
          <p className="px-6 py-3 text-xs text-slate-400">Profit = Collections − Commission − Salaries − Expenses</p>
        </div>
      )}
    </div>
  );
}
