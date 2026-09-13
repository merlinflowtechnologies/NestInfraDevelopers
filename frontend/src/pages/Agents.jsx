import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Eye, Award, UserCheck, Users, IndianRupee, Shield, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api, { errMsg } from "../lib/api";
import { inr, fdate, monthLabel, currentMonth } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, DataTable, StatusBadge } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";

export default function Agents() {
  const { user, isAdmin, isLead } = useAuth();
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leadsList, setLeadsList] = useState([]);
  const [activeTab, setActiveTab] = useState("all"); // all | lead | agent
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);
  const [dash, setDash] = useState(null);
  const [appointModal, setAppointModal] = useState({ open: false, agent: null, role: "team_lead", lead_code: "", team_id: "" });
  const [payCommModal, setPayCommModal] = useState({ open: false, sale: null, amount: "", notes: "", who: "agent" });

  const load = useCallback(async () => {
    try {
      const [agRes, tmRes, ldRes] = await Promise.all([
        api.get("/agents"),
        api.get("/teams"),
        api.get("/leads-list"),
      ]);
      setAgents(agRes.data);
      setTeams(tmRes.data);
      setLeadsList(ldRes.data);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view) {
      api.get(`/agents/${view.agent_code}/dashboard?month=${currentMonth()}`).then((r) => setDash(r.data));
    }
  }, [view]);

  const teamLeads = agents.filter((a) => a.role === "team_lead" || a.is_team_lead);
  const regularAgents = agents.filter((a) => a.role !== "team_lead" && !a.is_team_lead);

  const filteredAgents = agents.filter((a) => {
    if (activeTab === "lead") return a.role === "team_lead" || a.is_team_lead;
    if (activeTab === "agent") return a.role !== "team_lead" && !a.is_team_lead;
    return true;
  });

  const formFields = [
    { name: "agent_code", label: "Agent / Staff ID", required: true, placeholder: "NIA010" },
    { name: "name", label: "Full Name", required: true },
    { name: "mobile", label: "Mobile Number", required: true },
    {
      name: "role",
      label: "Role",
      type: "select",
      options: [
        { value: "agent", label: "Sales Agent" },
        { value: "team_lead", label: "Team Leader (Manager)" },
      ],
    },
    {
      name: "lead_code",
      label: "Reporting Team Leader (for Agents)",
      type: "select",
      options: [
        { value: "", label: "None / Direct to Admin" },
        ...teamLeads.map((l) => ({ value: l.agent_code, label: `${l.name} (${l.agent_code})` })),
      ],
    },
    {
      name: "team_id",
      label: "Assigned Team",
      type: "select",
      options: [
        { value: "", label: "No Team" },
        ...teams.map((t) => ({ value: t.id, label: t.name })),
      ],
    },
    {
      name: "designation",
      label: "Designation",
      type: "select",
      options: [
        { value: "Team Leader", label: "Team Leader" },
        { value: "Senior Sales Manager", label: "Senior Sales Manager" },
        { value: "Senior Sales Executive", label: "Senior Sales Executive" },
        { value: "Sales Executive", label: "Sales Executive" },
        { value: "Business Associate", label: "Business Associate" },
      ],
    },
    { name: "joining_date", label: "Joining Date", type: "date" },
    { name: "commission_rate", label: "Standard Commission %", type: "number", placeholder: "2.0" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    {
      name: "password",
      label: "Login Password",
      placeholder: "Default: nest@123",
      hint: "User logs in with their ID + this password",
    },
  ];

  const submitForm = async (v) => {
    try {
      const payload = {
        agent_code: v.agent_code,
        name: v.name,
        mobile: v.mobile,
        role: v.role || "agent",
        lead_code: v.lead_code || "",
        team_id: v.team_id || "",
        designation: v.designation || "",
        joining_date: v.joining_date || "",
        commission_plan: v.commission_plan || "",
        commission_rate: parseFloat(v.commission_rate) || 2.0,
        status: v.status || "active",
        password: v.password || "",
      };

      if (form.initial?.id) {
        await api.put(`/agents/${form.initial.id}`, payload);
        toast.success("Staff profile updated successfully");
      } else {
        await api.post("/agents", payload);
        toast.success(`Staff member created (${v.role === "team_lead" ? "Team Leader" : "Agent"} ID: ${v.agent_code.toUpperCase()})`);
      }
      setForm({ open: false, initial: null });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleAppointRole = async (e) => {
    e.preventDefault();
    if (!appointModal.agent) return;
    try {
      await api.post(`/agents/${appointModal.agent.id}/appoint-role`, {
        role: appointModal.role,
        lead_code: appointModal.lead_code || "",
        team_id: appointModal.team_id || "",
      });
      toast.success(
        appointModal.role === "team_lead"
          ? `${appointModal.agent.name} is now appointed as Team Leader!`
          : `${appointModal.agent.name} is now designated as Sales Agent.`
      );
      setAppointModal({ open: false, agent: null, role: "team_lead", lead_code: "", team_id: "" });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handlePayCommission = async (e) => {
    e.preventDefault();
    if (!payCommModal.sale) return;
    try {
      await api.post("/commission/pay", {
        sale_id: payCommModal.sale.id,
        who: payCommModal.who,
        amount: parseFloat(payCommModal.amount) || 0,
        notes: payCommModal.notes,
      });
      toast.success("Commission payment recorded successfully!");
      setPayCommModal({ open: false, sale: null, amount: "", notes: "", who: "agent" });
      if (view) {
        api.get(`/agents/${view.agent_code}/dashboard?month=${currentMonth()}`).then((r) => setDash(r.data));
      }
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  // Calculations
  const totalSales = agents.reduce((s, a) => s + (a.total_sales || 0), 0);
  const totalBookings = agents.reduce((s, a) => s + (a.total_bookings || 0), 0);
  const totalCommPending = agents.reduce((s, a) => s + (a.commission_pending || 0), 0);

  return (
    <div data-testid="agents-page" className="space-y-6">
      <PageHeader
        title={isAdmin ? "Staff & Team Hierarchy" : isLead ? "My Team (Agents & Leads)" : "My Profile"}
        sub={
          isAdmin
            ? "Create agents, appoint team leaders, and manage sales hierarchy"
            : isLead
            ? `Manage agents reporting to you (${user.name} · ${user.agent_code}) and distribute commissions`
            : "Your performance, assigned leads, and commission statements"
        }
        testid="agents-header"
      >
        {isAdmin && (
          <Button
            className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
            onClick={() => setForm({ open: true, initial: null })}
            data-testid="add-agent-button"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Staff Member
          </Button>
        )}
      </PageHeader>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isAdmin ? "Total Staff" : "My Team Size"}
            </span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-num text-2xl font-bold text-slate-900">{agents.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {teamLeads.length} Team Leads · {regularAgents.length} Agents
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isAdmin ? "Total Sales" : "Team Sales"}
            </span>
            <ArrowUpRight className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-num text-2xl font-bold text-slate-900">{inr(totalSales)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{totalBookings} Total Plot Bookings</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Team Leaders</span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 font-num text-2xl font-bold text-slate-900">{teamLeads.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Appointed Leaders</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Comm.</span>
            <IndianRupee className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 font-num text-2xl font-bold text-rose-700">{inr(totalCommPending)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">To be distributed</p>
        </div>
      </div>

      {/* Tabs Filter for Admin */}
      {isAdmin && (
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {[
            { id: "all", label: `All Staff (${agents.length})` },
            { id: "lead", label: `👑 Team Leads (${teamLeads.length})` },
            { id: "agent", label: `💼 Sales Agents (${regularAgents.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Agents & Leads Table */}
      <DataTable
        testid="agents-table"
        columns={[
          {
            key: "agent_code",
            label: "ID",
            render: (r) => (
              <span className="font-num font-semibold text-slate-900">{r.agent_code}</span>
            ),
          },
          {
            key: "name",
            label: "Name & Role",
            render: (r) => (
              <div>
                <p className="font-medium text-slate-900">{r.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {r.role === "team_lead" || r.is_team_lead ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                      👑 Team Leader
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                      💼 Sales Agent
                    </span>
                  )}
                  {r.designation && <span className="text-[11px] text-slate-400">· {r.designation}</span>}
                </div>
              </div>
            ),
          },
          { key: "mobile", label: "Mobile" },
          {
            key: "lead_name",
            label: "Reporting Lead",
            render: (r) =>
              r.role === "team_lead" ? (
                <span className="text-xs font-medium text-purple-600">Self (Team Leader)</span>
              ) : r.lead_name ? (
                <div>
                  <span className="text-xs font-medium text-slate-800">{r.lead_name}</span>
                  <span className="ml-1 text-[10px] text-slate-400 font-num">({r.lead_code})</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Direct to Admin</span>
              ),
          },
          { key: "team_name", label: "Team", render: (r) => r.team_name || "-" },
          {
            key: "total_sales",
            label: "Sales / Bookings",
            render: (r) => (
              <div>
                <p className="font-num text-xs font-bold text-slate-900">{inr(r.total_sales || 0)}</p>
                <p className="text-[10px] text-slate-400">{r.total_bookings || 0} plots</p>
              </div>
            ),
          },
          {
            key: "commission_pending",
            label: "Pending Comm.",
            align: "right",
            render: (r) => (
              <span
                className={`font-num text-xs font-bold ${
                  (r.commission_pending || 0) > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {inr(r.commission_pending || 0)}
              </span>
            ),
          },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            label: "Actions",
            render: (r) => (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="View performance"
                  title="View Performance & Commissions"
                  onClick={() => {
                    setView(r);
                    setDash(null);
                  }}
                >
                  <Eye className="h-4 w-4 text-slate-600" />
                </Button>

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Appoint role"
                    title="Appoint as Team Lead / Change Reporting"
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    onClick={() =>
                      setAppointModal({
                        open: true,
                        agent: r,
                        role: r.role === "team_lead" ? "agent" : "team_lead",
                        lead_code: r.lead_code || "",
                        team_id: r.team_id || "",
                      })
                    }
                  >
                    <Award className="h-4 w-4" />
                  </Button>
                )}

                {(isAdmin || isLead) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Edit agent"
                    onClick={() => setForm({ open: true, initial: { ...r, password: "" } })}
                  >
                    <Pencil className="h-4 w-4 text-slate-600" />
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete agent"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => setDel(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        rows={filteredAgents}
        onRowClick={(r) => {
          setView(r);
          setDash(null);
        }}
      />

      {/* Appoint as Team Lead / Change Role Modal */}
      <Dialog
        open={appointModal.open}
        onOpenChange={(o) => setAppointModal({ ...appointModal, open: o })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              Appoint Role for {appointModal.agent?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAppointRole} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Designated Role</Label>
              <select
                value={appointModal.role}
                onChange={(e) => setAppointModal({ ...appointModal, role: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="team_lead">👑 Team Leader (Manages Agents & Commissions)</option>
                <option value="agent">💼 Sales Agent (Reports to Team Lead)</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                {appointModal.role === "team_lead"
                  ? "Team Leaders can log in to view their agents, assign leads, and give commissions."
                  : "Sales Agents report to an appointed Team Leader and view their sales."}
              </p>
            </div>

            {appointModal.role === "agent" && (
              <div>
                <Label className="text-xs font-semibold text-slate-700">Assign Reporting Team Leader</Label>
                <select
                  value={appointModal.lead_code}
                  onChange={(e) => setAppointModal({ ...appointModal, lead_code: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">Direct to Admin (No Team Leader)</option>
                  {teamLeads
                    .filter((l) => l.agent_code !== appointModal.agent?.agent_code)
                    .map((l) => (
                      <option key={l.agent_code} value={l.agent_code}>
                        {l.name} ({l.agent_code})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-700">Assigned Team</Label>
              <select
                value={appointModal.team_id}
                onChange={(e) => setAppointModal({ ...appointModal, team_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="">No Team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAppointModal({ open: false, agent: null, role: "team_lead", lead_code: "", team_id: "" })}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-purple-700 hover:bg-purple-800 text-white">
                Save & Appoint Role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Agent/Lead Performance & Commission Modal */}
      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="agent-dashboard-dialog">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  {view?.name}
                  <span className="font-num text-sm text-slate-400">({view?.agent_code})</span>
                  {view?.role === "team_lead" || view?.is_team_lead ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                      👑 Team Leader
                    </span>
                  ) : (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      💼 Agent
                    </span>
                  )}
                </DialogTitle>
                {dash?.lead_info && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reports to: <span className="font-semibold text-slate-700">{dash.lead_info.name}</span> ({dash.lead_info.agent_code})
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {!dash ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={`skel-${i}`} className="h-16 rounded-md bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Total Sales", inr(dash.total_sales)],
                  ["Monthly Sales", inr(dash.monthly_sales)],
                  ["Total Bookings", `${dash.total_bookings} plots`],
                  ["Total Collection", inr(dash.total_collection)],
                  ["Commission Earned", inr(dash.commission_earned)],
                  ["Commission Paid", inr(dash.commission_paid)],
                  ["Commission Pending", inr(dash.commission_pending)],
                  ["Monthly Collection", inr(dash.monthly_collection)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{l}</p>
                    <p className="mt-1 font-num text-sm font-bold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>

              {/* Commission Distribution & Payout Action */}
              {(isAdmin || isLead) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                        <IndianRupee className="h-4 w-4 text-emerald-700" />
                        Commission Management & Distribution
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Current pending commission: <span className="font-bold">{inr(dash.commission_pending)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <h3 className="font-display text-sm font-semibold text-slate-800 pt-2">Recent Sales & Commission Status</h3>
              <DataTable
                testid="agent-sales-table"
                columns={[
                  { key: "date", label: "Date", render: (r) => fdate(r.date) },
                  { key: "project_name", label: "Project" },
                  { key: "plot_number", label: "Plot" },
                  { key: "sale_amount", label: "Sale Amount", align: "right", render: (r) => inr(r.sale_amount) },
                  {
                    key: "agent_commission",
                    label: "Commission",
                    align: "right",
                    render: (r) => (
                      <div>
                        <p className="font-num text-xs font-bold text-slate-900">{inr(r.agent_commission)}</p>
                        <p className="text-[10px] text-slate-500">Paid: {inr(r.agent_commission_paid || 0)}</p>
                      </div>
                    ),
                  },
                  {
                    key: "commission_pending",
                    label: "Pending",
                    align: "right",
                    render: (r) => {
                      const pend = (r.agent_commission || 0) - (r.agent_commission_paid || 0);
                      return (
                        <span className={`font-num text-xs font-bold ${pend > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {inr(pend)}
                        </span>
                      );
                    },
                  },
                  {
                    key: "pay_action",
                    label: "",
                    render: (r) => {
                      const pend = (r.agent_commission || 0) - (r.agent_commission_paid || 0);
                      if (!isAdmin && !isLead) return null;
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pend <= 0}
                          className="h-7 text-xs bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() =>
                            setPayCommModal({
                              open: true,
                              sale: r,
                              amount: pend.toString(),
                              notes: `Commission payout for Plot ${r.plot_number} (${r.project_name})`,
                              who: "agent",
                            })
                          }
                        >
                          Give Comm.
                        </Button>
                      );
                    },
                  },
                ]}
                rows={dash.recent_sales || []}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay / Distribute Commission Modal */}
      <Dialog
        open={payCommModal.open}
        onOpenChange={(o) => setPayCommModal({ ...payCommModal, open: o })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2 text-emerald-800">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Pay Commission to {payCommModal.sale?.agent_name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayCommission} className="space-y-4 pt-2">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
              <p>
                <span className="text-slate-500">Project / Plot:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {payCommModal.sale?.project_name} · Plot {payCommModal.sale?.plot_number}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Customer:</span>{" "}
                <span className="font-semibold text-slate-800">{payCommModal.sale?.customer_name}</span>
              </p>
              <p>
                <span className="text-slate-500">Sale Value:</span>{" "}
                <span className="font-semibold text-slate-800">{inr(payCommModal.sale?.sale_amount || 0)}</span>
              </p>
              <p>
                <span className="text-slate-500">Total Commission:</span>{" "}
                <span className="font-semibold text-slate-800">{inr(payCommModal.sale?.agent_commission || 0)}</span>
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Payment Amount (₹)</Label>
              <Input
                type="number"
                required
                min="1"
                step="any"
                value={payCommModal.amount}
                onChange={(e) => setPayCommModal({ ...payCommModal, amount: e.target.value })}
                className="mt-1"
                placeholder="Enter amount in ₹"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Payout Remarks / Notes</Label>
              <Input
                type="text"
                value={payCommModal.notes}
                onChange={(e) => setPayCommModal({ ...payCommModal, notes: e.target.value })}
                className="mt-1"
                placeholder="UPI Ref / Cheque / Bank Transfer"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayCommModal({ open: false, sale: null, amount: "", notes: "", who: "agent" })}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                Record Payout
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Form Dialog */}
      <FormDialog
        open={form.open}
        onOpenChange={(o) => setForm({ open: o, initial: null })}
        title={form.initial ? "Edit Staff Profile" : "Add Staff Member"}
        fields={formFields}
        initial={form.initial}
        onSubmit={submitForm}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete Staff Record"
        desc={`Are you sure you want to delete ${del?.name} (${del?.agent_code})? This will also remove their login credentials.`}
        onConfirm={async () => {
          try {
            await api.delete(`/agents/${del.id}`);
            toast.success("Staff profile deleted");
            setDel(null);
            load();
          } catch (err) {
            toast.error(errMsg(err));
          }
        }}
      />
    </div>
  );
}
