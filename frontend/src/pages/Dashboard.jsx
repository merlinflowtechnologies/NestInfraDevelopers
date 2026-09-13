import { useEffect, useState } from "react";
import {
  Building2, Handshake, IndianRupee, Percent, Wallet, Receipt, TrendingUp, Layers,
  KeyRound, HelpCircle, Phone, Mail, MapPin, ShieldAlert, CheckCircle2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../lib/api";
import { inr, monthLabel, currentMonth, fdate } from "../lib/format";
import { PageHeader, StatCard, DataTable, StatusBadge, inputCls } from "../components/common";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ChangePasswordModal from "../components/ChangePasswordModal";

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [company, setCompany] = useState(null);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  useEffect(() => {
    setData(null);
    api.get(`/dashboard?month=${month}`).then((r) => setData(r.data)).catch(() => {});
    api.get("/admin/company-settings").then((r) => setCompany(r.data)).catch(() => {});
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
  const isAgent = user.role === "agent";
  const inv = data.inventory;

  return (
    <div data-testid="dashboard-page" className="space-y-6">
      {/* Agent Welcome & Correction Notice Banner */}
      {isAgent && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 p-5 text-white shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                  Agent ID: {user.agent_code}
                </span>
                <span className="text-xs text-slate-400">· Field Associate Portal</span>
                {user.password_changed ? (
                  <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Password Secured
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[11px] font-medium text-amber-300 border border-amber-700/50">
                    ⚠️ 1-Time Password Setup Pending
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold tracking-tight">Welcome, {user.name}!</h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {!user.password_changed ? (
                  <>
                    🔒 <strong>1-Time Password Setup:</strong> You have 1-time access to set your private password. Once updated, any further changes require management approval.
                  </>
                ) : (
                  <>
                    🔒 <strong>Account Secured:</strong> Your private password has been set.
                  </>
                )}
                <br />
                ⚠️ <strong>Profile Corrections / Password Resets:</strong> If any corrections are needed in your name, mobile, team, commissions, or password reset, please contact management / domain admin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!user.password_changed ? (
                <Button
                  onClick={() => setPwModalOpen(true)}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow"
                >
                  <KeyRound className="h-4 w-4" /> Set Private Password (1-Time)
                </Button>
              ) : (
                <Button
                  onClick={() => setContactModalOpen(true)}
                  size="sm"
                  className="bg-slate-800 text-emerald-300 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Password Locked (Contact Admin)
                </Button>
              )}
              <Button
                onClick={() => setContactModalOpen(true)}
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white flex items-center gap-1.5"
              >
                <HelpCircle className="h-4 w-4 text-emerald-400" /> Contact Domain Admin
              </Button>
            </div>
          </div>
        </div>
      )}

      <PageHeader title={isAdmin ? "Executive Dashboard" : "My Agent Dashboard"} sub={`Performance Overview for ${monthLabel(month)}`} testid="dashboard-header">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={inputCls + " w-auto"}
          data-testid="dashboard-month-picker"
        />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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

      <div className="mt-4 sm:mt-6 rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm">
        <h2 className="font-display text-base sm:text-lg font-medium text-slate-800">Sales vs Collections (last 6 months)</h2>
        <div className="mt-3 sm:mt-4 h-60 sm:h-72 min-h-[220px]" data-testid="dashboard-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={data.chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
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
      <ChangePasswordModal
        open={pwModalOpen}
        onOpenChange={setPwModalOpen}
        user={user}
      />

      {/* Contact Domain / Management Helpdesk Dialog */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="max-w-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldAlert className="h-5 w-5 text-emerald-600" />
              Management & Profile Correction Helpdesk
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              If any corrections are needed in your <strong>registered name, mobile number, team leader assignment, or commission rate</strong>, please reach out directly to the management team:
            </p>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-700">
                <Phone className="h-4 w-4 text-emerald-600" />
                <span>
                  <strong>Helpline / Phone:</strong>{" "}
                  <a href={`tel:${company?.phone || "+919848012345"}`} className="text-emerald-700 font-semibold hover:underline">
                    {company?.phone || "+91 98480 12345"}
                  </a>
                </span>
              </div>

              <div className="flex items-center gap-2.5 text-slate-700">
                <Mail className="h-4 w-4 text-emerald-600" />
                <span>
                  <strong>Official Email:</strong>{" "}
                  <a href={`mailto:${company?.email || "admin@nestinfradevelopers.in"}`} className="text-emerald-700 font-semibold hover:underline">
                    {company?.email || "admin@nestinfradevelopers.in"}
                  </a>
                </span>
              </div>

              <div className="flex items-start gap-2.5 text-slate-700">
                <MapPin className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Head Office:</strong> {company?.address || "Hyderabad, Telangana"}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactModalOpen(false)}
              >
                Close
              </Button>
              <a
                href={`mailto:${company?.email || "admin@nestinfradevelopers.in"}?subject=Profile%20Correction%20Request%20-%20${user?.agent_code}&body=Hi%20Management,%0D%0A%0D%0AMy%20Agent%20ID:%20${user?.agent_code}%0D%0AMy%20Name:%20${user?.name}%0D%0A%0D%0ACorrection%20Details:%0D%0A`}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" /> Send Email Request
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
