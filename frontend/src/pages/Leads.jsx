import React, { useState, useEffect } from "react";
import api, { errMsg } from "../lib/api";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  UserPlus,
  Calendar,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Filter,
  Plus,
  ArrowRight,
  Eye,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "new", label: "New Leads", color: "bg-blue-50 text-blue-800 border-blue-200" },
  { key: "contacted", label: "Contacted", color: "bg-purple-50 text-purple-800 border-purple-200" },
  { key: "site_visit_scheduled", label: "Site Visit Scheduled", color: "bg-amber-50 text-amber-800 border-amber-200" },
  { key: "negotiation", label: "Negotiation", color: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  { key: "won", label: "Won / Booking", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { key: "lost", label: "Lost", color: "bg-rose-50 text-rose-800 border-rose-200" },
];

export default function Leads({ user }) {
  const isAdmin = user?.role === "admin";
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStage, setFilterStage] = useState("all");
  const [filterProject, setFilterProject] = useState("all");

  // Modals
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [siteVisitModal, setSiteVisitModal] = useState({ open: false, lead: null });
  const [detailModal, setDetailModal] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    project_id: "",
    budget: "",
    preferred_plot_size: "",
    source: "Website",
    status: "new",
    assigned_agent_code: "",
    notes: "",
  });

  const [visitForm, setVisitForm] = useState({
    visit_date: "",
    assigned_agent: "",
    notes: "",
    status: "scheduled",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, projectsRes, agentsRes] = await Promise.all([
        api.get("/leads"),
        api.get("/projects"),
        api.get("/agents").catch(() => ({ data: [] })),
      ]);
      setLeads(leadsRes.data || []);
      setProjects(projectsRes.data || []);
      setAgents(agentsRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveLead = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : 0,
      };
      if (editingLead) {
        await api.put(`/leads/${editingLead.id}`, payload);
        toast.success("Lead updated successfully");
      } else {
        await api.post("/leads", payload);
        toast.success("New lead created");
      }
      setLeadModalOpen(false);
      setEditingLead(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to save lead");
    }
  };

  const handleSaveSiteVisit = async (e) => {
    e.preventDefault();
    if (!siteVisitModal.lead) return;
    try {
      await api.post(`/leads/${siteVisitModal.lead.id}/site-visits`, visitForm);
      toast.success("Site visit scheduled successfully");
      setSiteVisitModal({ open: false, lead: null });
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to schedule site visit");
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await api.put(`/leads/${leadId}`, { status: newStatus });
      toast.success(`Lead moved to ${newStatus.replace("_", " ")}`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to update status");
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;
    try {
      await api.delete(`/leads/${leadId}`);
      toast.success("Lead deleted");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to delete lead");
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (filterStage !== "all" && l.status !== filterStage) return false;
    if (filterProject !== "all" && l.project_id !== filterProject) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads & Site Visits</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track customer inquiries, schedule venture site visits, and convert leads into plot sales.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingLead(null);
            setFormData({
              name: "",
              mobile: "",
              email: "",
              project_id: projects[0]?.id || "",
              budget: "",
              preferred_plot_size: "200 sq.yds",
              source: "Website",
              status: "new",
              assigned_agent_code: agents[0]?.agent_code || "",
              notes: "",
            });
            setLeadModalOpen(true);
          }}
          className="gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
        >
          <UserPlus className="h-4 w-4" /> Add New Lead
        </Button>
      </div>

      {/* Stage Stat Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGES.map((s) => {
          const count = leads.filter((l) => l.status === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setFilterStage(filterStage === s.key ? "all" : s.key)}
              className={`rounded-xl border p-3 text-left transition-all ${
                filterStage === s.key ? "ring-2 ring-slate-900 bg-white shadow-md" : "bg-white hover:bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">{s.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.color}`}>
                  {count}
                </span>
              </div>
              <p className="mt-2 text-xl font-bold font-num text-slate-900">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredLeads.length}</strong> leads
        </p>
      </div>

      {/* Leads Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="p-3">Customer Info</th>
                <th className="p-3">Interested Project & Size</th>
                <th className="p-3">Budget</th>
                <th className="p-3">Source & Agent</th>
                <th className="p-3">Stage / Status</th>
                <th className="p-3">Site Visits</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLeads.map((lead) => {
                const stage = STAGES.find((s) => s.key === lead.status) || STAGES[0];
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-slate-900 text-sm">{lead.name}</p>
                      <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {lead.mobile}
                      </p>
                      {lead.email && (
                        <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-800 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-600" /> {lead.project_name || "General"}
                      </p>
                      <p className="text-slate-500 mt-0.5">Plot Size: {lead.preferred_plot_size || "200 sq.yds"}</p>
                    </td>
                    <td className="p-3 font-num font-bold text-slate-900">
                      {lead.budget ? `₹${lead.budget.toLocaleString()}` : "-"}
                    </td>
                    <td className="p-3">
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-bold uppercase text-[9px] text-slate-700">
                        {lead.source}
                      </span>
                      <p className="text-slate-500 mt-1">
                        Agent: <strong className="text-slate-700">{lead.assigned_agent_name || lead.assigned_agent_code || "-"}</strong>
                      </p>
                    </td>
                    <td className="p-3">
                      <Select
                        value={lead.status}
                        onValueChange={(newStatus) => handleStatusChange(lead.id, newStatus)}
                      >
                        <SelectTrigger className={`h-7 w-[140px] text-[11px] font-bold uppercase ${stage.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s.key} value={s.key} className="text-xs font-semibold">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      {lead.site_visits && lead.site_visits.length > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            <Calendar className="h-3 w-3" /> {lead.site_visits[lead.site_visits.length - 1].visit_date}
                          </span>
                          <p className="text-[10px] text-slate-500">
                            {lead.site_visits[lead.site_visits.length - 1].notes || "Visit scheduled"}
                          </p>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSiteVisitModal({ open: true, lead });
                            setVisitForm({
                              visit_date: "",
                              assigned_agent: lead.assigned_agent_name || user?.name || "",
                              notes: "",
                              status: "scheduled",
                            });
                          }}
                          className="h-7 text-[10px] gap-1 text-slate-600 border-dashed"
                        >
                          <Plus className="h-3 w-3" /> Schedule Visit
                        </Button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingLead(lead);
                            setFormData({
                              name: lead.name,
                              mobile: lead.mobile,
                              email: lead.email || "",
                              project_id: lead.project_id || "",
                              budget: lead.budget || "",
                              preferred_plot_size: lead.preferred_plot_size || "",
                              source: lead.source || "Website",
                              status: lead.status || "new",
                              assigned_agent_code: lead.assigned_agent_code || "",
                              notes: lead.notes || "",
                            });
                            setLeadModalOpen(true);
                          }}
                          className="h-7 w-7 p-0"
                          title="Edit Lead"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLead(lead.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                            title="Delete Lead"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold">No leads found</p>
            <p className="text-xs mt-1">Try changing filters or create a new lead.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Lead Dialog */}
      <Dialog open={leadModalOpen} onOpenChange={setLeadModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingLead ? "Edit Lead Details" : "Create New Inquiry / Lead"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLead} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name *</Label>
                <Input
                  required
                  placeholder="e.g. Ramesh Reddy"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mobile Number *</Label>
                <Input
                  required
                  placeholder="e.g. 9848012345"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  placeholder="customer@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Interested Project</Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(val) => setFormData({ ...formData, project_id: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 3500000"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plot Size</Label>
                <Input
                  placeholder="e.g. 200 sq.yds"
                  value={formData.preferred_plot_size}
                  onChange={(e) => setFormData({ ...formData, preferred_plot_size: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(val) => setFormData({ ...formData, source: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                    <SelectItem value="Google Ads">Google Ads</SelectItem>
                    <SelectItem value="Direct Walk-in">Direct Walk-in</SelectItem>
                    <SelectItem value="Channel Partner">Channel Partner</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Label className="text-xs">Assigned Agent</Label>
                <Select
                  value={formData.assigned_agent_code}
                  onValueChange={(val) => setFormData({ ...formData, assigned_agent_code: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((ag) => (
                      <SelectItem key={ag.id} value={ag.agent_code}>
                        {ag.name} ({ag.agent_code}) - {ag.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes & Requirements</Label>
              <Textarea
                placeholder="Preferred facing, timeline, negotiation notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLeadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-slate-900 text-white">
                {editingLead ? "Update Lead" : "Create Lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Site Visit Dialog */}
      <Dialog
        open={siteVisitModal.open}
        onOpenChange={(open) => !open && setSiteVisitModal({ open: false, lead: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Schedule Venture Site Visit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSiteVisit} className="space-y-4 pt-2">
            <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
              <p className="font-bold text-slate-800">{siteVisitModal.lead?.name}</p>
              <p className="text-slate-500">Project: {siteVisitModal.lead?.project_name || "Venture"}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Visit Date & Time *</Label>
              <Input
                required
                placeholder="e.g. 2026-09-12 10:30 AM"
                value={visitForm.visit_date}
                onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Assigned Accompanying Agent</Label>
              <Input
                placeholder="Agent name"
                value={visitForm.assigned_agent}
                onChange={(e) => setVisitForm({ ...visitForm, assigned_agent: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Visit Instructions & Pickup Notes</Label>
              <Textarea
                placeholder="e.g. Pickup from Suchitra junction, customer visiting with family..."
                value={visitForm.notes}
                onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSiteVisitModal({ open: false, lead: null })}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                Confirm Site Visit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
