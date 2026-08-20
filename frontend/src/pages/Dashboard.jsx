import { useEffect, useState } from "react";
import {
  Building2, Handshake, IndianRupee, Percent, Wallet, Receipt, TrendingUp, Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../lib/api";
import { inr, monthLabel, currentMonth, fdate } from "../lib/format";
import { PageHeader, StatCard, DataTable, StatusBadge, inputCls } from "../components/common";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/dashboard?month=${month}`).then((r) => setData(r.data)).catch(() => {});
  }, [month]);

  if (!data)
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse" data-testid="dashboard-loading">
        {[...Array(8)].map((_, i) => (
          <div key={`skel-${i}`} className="h-28 rounded-lg bg-slate-200" />
        ))}
      </div>
    );

  const isAdmin = user.role === "admin";
  const inv = data.inventory;

  return (
    <div data-testid="dashboard-page">
      <PageHeader title="Dashboard" sub={`Overview for ${monthLabel(month)}`} testid="dashboard-header">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={inputCls + " w-auto"}
          data-testid="dashboard-month-picker"
        />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={inv.total_projects} icon={Building2} sub={`${inv.total_plots} total plots`} testid="stat-projects" />
        <StatCard label="Available Plots" value={inv.available_plots} icon={Layers} tone="green" testid="stat-available" />
        <StatCard label="Booked Plots" value={inv.booked_plots} icon={Handshake} tone="amber" testid="stat-booked" />
        <StatCard label="Sold Plots" value={inv.sold_plots} icon={TrendingUp} tone="red" testid="stat-sold" />
        <StatCard label="Monthly Sales" value={inr(data.monthly_sales)} icon={TrendingUp} testid="stat-monthly-sales" />
        <StatCard label="Monthly Collection" value={inr(data.monthly_collection)} icon={IndianRupee} tone="green" testid="stat-monthly-collection" />
        <StatCard label="Monthly Commission" value={inr(data.monthly_commission)} icon={Percent} tone="amber" testid="stat-monthly-commission" />
        {isAdmin ? (
          <StatCard label="Estimated Profit" value={inr(data.estimated_profit)} icon={TrendingUp} tone={data.estimated_profit >= 0 ? "green" : "red"} sub="Collections − commission − salary − expenses" testid="stat-profit" />
        ) : (
          <StatCard label="My Total Sales" value={inr(data.total_sales)} icon={TrendingUp} testid="stat-my-sales" />
        )}
        {isAdmin && (
          <>
            <StatCard label="Monthly Salary" value={inr(data.monthly_salary)} icon={Wallet} testid="stat-monthly-salary" />
            <StatCard label="Monthly Expenses" value={inr(data.monthly_expenses)} icon={Receipt} testid="stat-monthly-expenses" />
          </>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-medium text-slate-800">Sales vs Collections (last 6 months)</h2>
        <div className="mt-4 h-72 min-h-[288px]" data-testid="dashboard-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#047857" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collections" name="Collections" fill="#0f172a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-medium text-slate-800">Top Agents</h2>
            <div className="mt-3 divide-y divide-slate-100" data-testid="top-agents">
              {data.top_agents?.length === 0 && <p className="py-4 text-sm text-slate-400">No sales yet</p>}
              {data.top_agents?.map((a, i) => (
                <div key={a.agent_code} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-xs font-bold text-emerald-700">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.agent_code} · {a.bookings} bookings</p>
                    </div>
                  </div>
                  <p className="font-num text-sm font-semibold text-slate-900">{inr(a.sales)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-medium text-slate-800">Top Teams</h2>
            <div className="mt-3 divide-y divide-slate-100" data-testid="top-teams">
              {data.top_teams?.length === 0 && <p className="py-4 text-sm text-slate-400">No sales yet</p>}
              {data.top_teams?.map((t, i) => (
                <div key={t.team_id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">{t.bookings} bookings</p>
                    </div>
                  </div>
                  <p className="font-num text-sm font-semibold text-slate-900">{inr(t.sales)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-3 font-display text-lg font-medium text-slate-800">Recent Sales</h2>
          <DataTable
            testid="recent-sales-table"
            columns={[
              { key: "date", label: "Date", render: (r) => fdate(r.date) },
              { key: "project_name", label: "Project" },
              { key: "plot_number", label: "Plot" },
              { key: "customer_name", label: "Customer" },
              { key: "sale_amount", label: "Amount", align: "right", render: (r) => inr(r.sale_amount) },
              { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            ]}
            rows={data.recent_sales || []}
          />
        </div>
        <div className="min-w-0">
          <h2 className="mb-3 font-display text-lg font-medium text-slate-800">Recent Payments</h2>
          <DataTable
            testid="recent-payments-table"
            columns={[
              { key: "date", label: "Date", render: (r) => fdate(r.date) },
              { key: "customer_name", label: "Customer" },
              { key: "project_name", label: "Project" },
              { key: "amount", label: "Amount", align: "right", render: (r) => inr(r.amount) },
              { key: "mode", label: "Mode" },
            ]}
            rows={data.recent_payments || []}
          />
        </div>
      </div>
    </div>
  );
}
