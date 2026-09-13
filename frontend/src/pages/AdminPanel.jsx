import { useEffect, useState } from "react";
import { 
  Building2, Users, UsersRound, Percent, ShieldCheck, 
  Trash2, RefreshCw, UploadCloud, CheckCircle2, AlertTriangle, 
  Copy, KeyRound, Building, Plus, FileSpreadsheet, Save
} from "lucide-react";
import { toast } from "sonner";
import api, { errMsg } from "../lib/api";
import { PageHeader, inputCls, FormDialog, ConfirmDialog } from "../components/common";
import { Button } from "../components/ui/button";

const ENTITIES = [
  { value: "projects", label: "Projects / Ventures" },
  { value: "agents", label: "Agents & Associates" },
  { value: "teams", label: "Teams & Leaders" },
  { value: "commission", label: "Commission Structure" },
  { value: "sales", label: "Sales & Bookings" },
  { value: "payments", label: "Payments / Collections" },
  { value: "salary", label: "Salary Records" },
  { value: "expenses", label: "Operational Expenses" },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("masters");
  
  // Masters Data
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  
  // Forms & Dialogs
  const [projectDialog, setProjectDialog] = useState({ open: false });
  const [plotGenDialog, setPlotGenDialog] = useState({ open: false, projectId: "" });
  const [agentDialog, setAgentDialog] = useState({ open: false });
  const [teamDialog, setTeamDialog] = useState({ open: false });
  const [resetDialog, setResetDialog] = useState({ open: false, mode: "" });
  const [confirmPhrase, setConfirmPhrase] = useState("");

  // Plot Generator Form
  const [plotGenForm, setPlotGenForm] = useState({
    start_plot: 1,
    total_plots: 50,
    default_size_sqyd: 167,
    default_rate: 18000,
    facing_pattern: "alternating",
    prefix: "",
  });

  // Company Settings
  const [company, setCompany] = useState({
    name: "Nest Infra Developers Pvt. Ltd.",
    tagline: "Plots. People. Performance.",
    gstin: "36AAACN1234F1Z5",
    rera_number: "P02400001234",
    phone: "+91 98480 12345",
    email: "info@nestinfradevelopers.in",
    website: "https://nestinfradevelopers.in",
    address: "Plot #42, Road #12, Banjara Hills, Hyderabad, Telangana - 500034",
    bank_name: "HDFC Bank",
    account_number: "50200012345678",
    ifsc_code: "HDFC0001234",
    branch: "Banjara Hills, Hyderabad",
    receipt_terms: "1. Cheque/Draft is subject to realization.\n2. Booking advance is non-refundable upon cancellation after 15 days.",
  });
  const [savingCompany, setSavingCompany] = useState(false);

  // Bulk Upload State
  const [uploadEntity, setUploadEntity] = useState("projects");
  const [hints, setHints] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  // Password Form
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "" });

  const loadData = async () => {
    try {
      const [pRes, aRes, tRes, cRes, hRes] = await Promise.all([
        api.get("/projects"),
        api.get("/agents"),
        api.get("/teams"),
        api.get("/admin/company-settings"),
        api.get("/admin/upload/template-info"),
      ]);
      setProjects(pRes.data);
      setAgents(aRes.data);
      setTeams(tRes.data);
      if (cRes.data) setCompany(cRes.data);
      if (hRes.data) setHints(hRes.data.columns || {});
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPreview(null);
    setFile(null);
  }, [uploadEntity]);

  // Company Settings Update
  const saveCompanySettings = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await api.post("/admin/company-settings", company);
      toast.success("Company profile and branding saved successfully!");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSavingCompany(false);
    }
  };

  // Quick Project Submit
  const submitProject = async (v) => {
    try {
      const payload = {
        name: v.name,
        location: v.location,
        project_type: v.project_type || "Open Plots",
        price: parseFloat(v.price) || 0,
        plot_sizes: v.plot_sizes || "167, 200, 267 sq.yds",
        total_plots: parseInt(v.total_plots) || 0,
        images: v.images ? (Array.isArray(v.images) ? v.images : [v.images]) : [],
        layout_image: v.layout_image || "",
        map_url: v.map_url || "",
        description: v.description || "",
      };
      await api.post("/projects", payload);
      toast.success(`Project "${v.name}" created with photos!`);
      setProjectDialog({ open: false });
      loadData();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Bulk Plot Matrix Generator
  const runPlotGenerator = async (e) => {
    e.preventDefault();
    if (!plotGenDialog.projectId) return toast.error("Select a project first");
    try {
      const res = await api.post("/admin/bulk-generate-plots", {
        project_id: plotGenDialog.projectId,
        ...plotGenForm,
      });
      toast.success(res.data.message);
      setPlotGenDialog({ open: false, projectId: "" });
      loadData();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Quick Agent Submit
  const submitAgent = async (v) => {
    try {
      await api.post("/agents", {
        agent_code: v.agent_code.toUpperCase(),
        name: v.name,
        mobile: v.mobile,
        team_id: v.team_id || "",
        designation: v.designation || "Sales Executive",
        commission_plan: v.commission_plan || "Standard (2%)",
        password: v.password || "nest@123",
        status: "active",
      });
      toast.success(`Agent "${v.name}" (${v.agent_code}) created successfully!`);
      setAgentDialog({ open: false });
      loadData();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Quick Team Submit
  const submitTeam = async (v) => {
    try {
      await api.post("/teams", {
        name: v.name,
        leader_code: v.leader_code || "",
        monthly_target: parseFloat(v.monthly_target) || 0,
      });
      toast.success(`Team "${v.name}" created!`);
      setTeamDialog({ open: false });
      loadData();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Data Reset / Purge Action
  const executeDataReset = async () => {
    if (confirmPhrase !== "CONFIRM_RESET") {
      return toast.error("Please type 'CONFIRM_RESET' to confirm.");
    }
    setBusy(true);
    try {
      const res = await api.post("/admin/reset-data", {
        mode: resetDialog.mode,
        confirm_phrase: confirmPhrase,
      });
      toast.success(res.data.message);
      setResetDialog({ open: false, mode: "" });
      setConfirmPhrase("");
      loadData();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Bulk Upload Preview & Confirm
  const doPreview = async () => {
    if (!file) return toast.error("Choose an Excel/CSV file first");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/admin/upload/${uploadEntity}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(r.data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    const errRows = new Set([
      ...preview.errors.map((e) => e.row),
      ...preview.duplicates.map((d) => d.row),
    ]);
    const validRows = preview.rows.filter((_, i) => !errRows.has(i + 2));
    if (validRows.length === 0) return toast.error("No valid rows to import");
    setBusy(true);
    try {
      const r = await api.post(`/admin/upload/${uploadEntity}/confirm`, { rows: validRows });
      toast.success(`Successfully imported ${r.data.inserted} records!`);
      setPreview(null);
      setFile(null);
      loadData();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Change Admin Password
  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/change-password", pwForm);
      toast.success("Admin password changed successfully!");
      setPwForm({ old_password: "", new_password: "" });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const cols = preview?.rows?.length ? Object.keys(preview.rows[0]) : [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Control Panel & Master Hub" 
        sub="Manage company branding, add ventures & plots, manage associates, bulk import data, and reset demo records."
      />

      {/* Top Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Live Projects</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{projects.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Agents</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{agents.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Sales Teams</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{teams.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Company Status</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">Verified & Active</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab("masters")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "masters"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Master Data Setup
        </button>

        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "company"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building className="h-4 w-4" />
          Company & Receipts Branding
        </button>

        <button
          onClick={() => setActiveTab("uploads")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "uploads"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          Bulk Excel Import
        </button>

        <button
          onClick={() => setActiveTab("reset")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "reset"
              ? "border-red-600 text-red-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          Demo Data Purge & Reset
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "security"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          Admin Security
        </button>
      </div>

      {/* TAB 1: MASTER DATA CREATOR */}
      {activeTab === "masters" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Add Venture Project */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Venture Projects
              </h3>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                {projects.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Create a new residential layout or open plots project with location and pricing.
            </p>
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => setProjectDialog({ open: true })}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> + Add New Venture
              </Button>
              <Button
                onClick={() => setPlotGenDialog({ open: true, projectId: projects[0]?.id || "" })}
                variant="outline"
                className="w-full text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4 text-emerald-600" /> Auto-Generate Plot Matrix
              </Button>
            </div>
          </div>

          {/* Add Sales Agent */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Sales Associates / Agents
              </h3>
              <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                {agents.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Add new real estate marketing agents, assign login passwords and team groupings.
            </p>
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => setAgentDialog({ open: true })}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> + Add New Agent
              </Button>
            </div>
          </div>

          {/* Add Sales Team */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-purple-600" />
                Sales Teams & Hierarchy
              </h3>
              <span className="text-xs bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                {teams.length} Teams
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Create marketing teams, assign Team Leaders and define monthly target quotas.
            </p>
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => setTeamDialog({ open: true })}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> + Create New Team
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY BRANDING & SETTINGS */}
      {activeTab === "company" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Company Profile & Official Letterhead</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                These details are automatically printed on official customer payment receipts, quotation sheets, and vouchers.
              </p>
            </div>
            <Button
              onClick={saveCompanySettings}
              disabled={savingCompany}
              className="bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {savingCompany ? "Saving..." : "Save Company Settings"}
            </Button>
          </div>

          <form onSubmit={saveCompanySettings} className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Company Legal Name</label>
              <input
                type="text"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className={inputCls + " mt-1"}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Tagline / Motto</label>
              <input
                type="text"
                value={company.tagline}
                onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">GSTIN Number</label>
              <input
                type="text"
                value={company.gstin}
                onChange={(e) => setCompany({ ...company, gstin: e.target.value })}
                className={inputCls + " mt-1"}
                placeholder="36AAACN1234F1Z5"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">TS RERA Number</label>
              <input
                type="text"
                value={company.rera_number}
                onChange={(e) => setCompany({ ...company, rera_number: e.target.value })}
                className={inputCls + " mt-1"}
                placeholder="P02400001234"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Official Phone / Helpline</label>
              <input
                type="text"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Official Email</label>
              <input
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-600">Registered Office Address</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Bank Name</label>
              <input
                type="text"
                value={company.bank_name}
                onChange={(e) => setCompany({ ...company, bank_name: e.target.value })}
                className={inputCls + " mt-1"}
                placeholder="HDFC Bank"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Bank Account Number</label>
              <input
                type="text"
                value={company.account_number}
                onChange={(e) => setCompany({ ...company, account_number: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">IFSC Code & Branch</label>
              <input
                type="text"
                value={company.ifsc_code}
                onChange={(e) => setCompany({ ...company, ifsc_code: e.target.value })}
                className={inputCls + " mt-1"}
                placeholder="HDFC0001234"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-600">Branch Name</label>
              <input
                type="text"
                value={company.branch}
                onChange={(e) => setCompany({ ...company, branch: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-600">Terms & Conditions (Printed on Receipts)</label>
              <textarea
                rows={3}
                value={company.receipt_terms}
                onChange={(e) => setCompany({ ...company, receipt_terms: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: BULK EXCEL IMPORT */}
      {activeTab === "uploads" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Select Entity to Import</label>
                <select
                  value={uploadEntity}
                  onChange={(e) => setUploadEntity(e.target.value)}
                  className={inputCls + " mt-1.5"}
                >
                  {ENTITIES.map((en) => (
                    <option key={en.value} value={en.value}>{en.label}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Expected Excel Columns: <br />
                  <span className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                    {hints[uploadEntity] || "Loading..."}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload Spreadsheet</label>
                <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-emerald-500 hover:bg-emerald-50">
                  <UploadCloud className="h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-600">{file ? file.name : "Click to select .xlsx or .csv"}</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                <Button
                  className="mt-3 w-full bg-slate-900 hover:bg-slate-700"
                  disabled={!file || busy}
                  onClick={doPreview}
                >
                  {busy ? "Parsing file..." : "Preview Spreadsheet Data"}
                </Button>
              </div>
            </div>
          </div>

          {preview && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 bg-slate-50">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {preview.valid} valid records
                  </span>
                  {preview.errors?.length > 0 && (
                    <span className="flex items-center gap-1.5 font-medium text-red-700">
                      <AlertTriangle className="h-4 w-4" /> {preview.errors.length} errors
                    </span>
                  )}
                  {preview.duplicates?.length > 0 && (
                    <span className="flex items-center gap-1.5 font-medium text-amber-700">
                      <Copy className="h-4 w-4" /> {preview.duplicates.length} duplicates
                    </span>
                  )}
                  <span className="text-slate-400">Total: {preview.total} rows</span>
                </div>
                <Button
                  className="bg-emerald-700 hover:bg-emerald-800"
                  disabled={busy || preview.valid === 0}
                  onClick={doConfirm}
                >
                  Confirm Import ({preview.valid} valid records)
                </Button>
              </div>

              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">#</th>
                      {cols.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-400">{i + 2}</td>
                        {cols.map((c) => (
                          <td key={c} className="whitespace-nowrap px-3 py-1.5 text-slate-800">{String(r[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DEMO DATA RESET & PURGE */}
      {activeTab === "reset" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Purge Demo Transactions */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                <RefreshCw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900">Clear Demo Transactions Only</h3>
                <p className="text-xs text-amber-700">Recommended before entering real live customer deals</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action safely purges all <strong>sample sales bookings, test payment records, mock customer leads, dummy salaries, and expenses</strong>.
              <br /><br />
              ✨ <strong>Preserved:</strong> Your real projects, plot numbers, agents, and admin logins will remain intact.
            </p>
            <Button
              onClick={() => {
                setResetDialog({ open: true, mode: "transactions_only" });
                setConfirmPhrase("");
              }}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold"
            >
              Clear Demo Transactions
            </Button>
          </div>

          {/* Full Fresh Start */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-800 rounded-lg">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-900">Factory Reset / Fresh Database</h3>
                <p className="text-xs text-red-700">Wipe all collections for a completely clean slate</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action deletes <strong>all dummy projects, demo agents, teams, sales, and payments</strong>.
              <br /><br />
              🔒 <strong>Preserved:</strong> Only your active Admin master login account is kept.
            </p>
            <Button
              onClick={() => {
                setResetDialog({ open: true, mode: "full_reset" });
                setConfirmPhrase("");
              }}
              variant="destructive"
              className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold"
            >
              Full Database Reset
            </Button>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY & ADMIN PASSWORD */}
      {activeTab === "security" && (
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Change Admin Master Password
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Update your primary administrative password for `nestinfradevelopers39@gmail.com`.
          </p>

          <form onSubmit={changePw} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Current Password</label>
              <input
                type="password"
                placeholder="Current password"
                value={pwForm.old_password}
                required
                onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">New Password (Min 6 chars)</label>
              <input
                type="password"
                placeholder="New password"
                value={pwForm.new_password}
                required
                minLength={6}
                onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                className={inputCls + " mt-1"}
              />
            </div>
            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-700">
              Update Password
            </Button>
          </form>
        </div>
      )}

      {/* DIALOG: Add Project */}
      <FormDialog
        open={projectDialog.open}
        onClose={() => setProjectDialog({ open: false })}
        title="Create New Venture Project"
        fields={[
          { name: "name", label: "Project / Venture Name (e.g. Nest Royal Palms)", required: true },
          { name: "location", label: "Location (e.g. Shadnagar, Hyderabad)", required: true },
          { 
            name: "project_type", 
            label: "Project Type", 
            type: "select", 
            options: [
              { value: "Open Plots", label: "Open Plots" },
              { value: "Gated Community Plots", label: "Gated Community Plots" },
              { value: "Villa Plots", label: "Villa Plots" },
              { value: "Farmland", label: "Farmland" },
            ] 
          },
          { name: "price", label: "Base Price (₹ / sq.yd)", type: "number", required: true },
          { name: "plot_sizes", label: "Plot Sizes (e.g. 167, 200, 267 sq.yds)" },
          { name: "total_plots", label: "Total Plots Count", type: "number", required: true },
          { name: "images", label: "Venture Cover Photo", type: "image", full: true, hint: "Upload venture photo from your phone/computer or enter URL" },
          { name: "layout_image", label: "Venture Master Layout Blueprint / Map", type: "image", full: true, hint: "Upload DTCP/HMDA approved layout blueprint image" },
          { name: "map_url", label: "Google Maps URL Link", full: true },
          { name: "description", label: "Short Venture Highlights & Amenities", type: "textarea", full: true },
        ]}
        onSubmit={submitProject}
      />

      {/* DIALOG: Auto-generate Plot Matrix */}
      {plotGenDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900">Auto-Generate Venture Plot Layout Grid</h3>
            <p className="text-xs text-slate-500 mt-1">
              Automatically create color-coded interactive plot squares (sizes, pricing, facing) for this project.
            </p>

            <form onSubmit={runPlotGenerator} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Select Target Project</label>
                <select
                  value={plotGenDialog.projectId}
                  onChange={(e) => setPlotGenDialog({ ...plotGenDialog, projectId: e.target.value })}
                  className={inputCls + " mt-1"}
                  required
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.location})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Starting Plot #</label>
                  <input
                    type="number"
                    value={plotGenForm.start_plot}
                    onChange={(e) => setPlotGenForm({ ...plotGenForm, start_plot: parseInt(e.target.value) || 1 })}
                    className={inputCls + " mt-1"}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Total Plots to Generate</label>
                  <input
                    type="number"
                    value={plotGenForm.total_plots}
                    onChange={(e) => setPlotGenForm({ ...plotGenForm, total_plots: parseInt(e.target.value) || 50 })}
                    className={inputCls + " mt-1"}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Standard Size (Sq.Yds)</label>
                  <input
                    type="number"
                    value={plotGenForm.default_size_sqyd}
                    onChange={(e) => setPlotGenForm({ ...plotGenForm, default_size_sqyd: parseFloat(e.target.value) || 167 })}
                    className={inputCls + " mt-1"}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Base Rate (₹ / Sq.Yd)</label>
                  <input
                    type="number"
                    value={plotGenForm.default_rate}
                    onChange={(e) => setPlotGenForm({ ...plotGenForm, default_rate: parseFloat(e.target.value) || 18000 })}
                    className={inputCls + " mt-1"}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Facing Rule</label>
                  <select
                    value={plotGenForm.facing_pattern}
                    onChange={(e) => setPlotGenForm({ ...plotGenForm, facing_pattern: e.target.value })}
                    className={inputCls + " mt-1"}
                  >
                    <option value="alternating">Alternating (East / West)</option>
                    <option value="east">All East Facing</option>
                    <option value="west">All West Facing</option>
                    <option value="north">All North Facing</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Plot Prefix (Optional)</label>
                  <input
                    type="text"
                    value={plotGenForm.prefix}
                    onChange={(e) => setPlotGenForm({ ...plotGenForm, prefix: e.target.value })}
                    className={inputCls + " mt-1"}
                    placeholder="e.g. P- or BLK-"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setPlotGenDialog({ open: false, projectId: "" })}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  Generate Plots Matrix
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG: Add Agent */}
      <FormDialog
        open={agentDialog.open}
        onClose={() => setAgentDialog({ open: false })}
        title="Add New Sales Associate / Agent"
        fields={[
          { name: "agent_code", label: "Agent Login ID / Code (e.g. NIA010)", required: true },
          { name: "name", label: "Full Name", required: true },
          { name: "mobile", label: "Mobile Number", required: true },
          { 
            name: "designation", 
            label: "Designation", 
            type: "select", 
            options: [
              { value: "Sales Executive", label: "Sales Executive" },
              { value: "Senior Sales Executive", label: "Senior Sales Executive" },
              { value: "Team Leader", label: "Team Leader" },
              { value: "Associate Director", label: "Associate Director" },
            ] 
          },
          { 
            name: "team_id", 
            label: "Assign Team", 
            type: "select", 
            options: teams.map((t) => ({ value: t.id, label: t.name })) 
          },
          { name: "commission_plan", label: "Commission Plan (e.g. Standard 2%)" },
          { name: "password", label: "Initial Login Password (default: nest@123)" },
        ]}
        onSubmit={submitAgent}
      />

      {/* DIALOG: Add Team */}
      <FormDialog
        open={teamDialog.open}
        onClose={() => setTeamDialog({ open: false })}
        title="Create New Sales Team"
        fields={[
          { name: "name", label: "Team Name (e.g. Team Royals)", required: true },
          { 
            name: "leader_code", 
            label: "Select Team Leader", 
            type: "select", 
            options: agents.map((a) => ({ value: a.agent_code, label: `${a.name} (${a.agent_code})` })) 
          },
          { name: "monthly_target", label: "Monthly Sales Target (₹)", type: "number" },
        ]}
        onSubmit={submitTeam}
      />

      {/* DIALOG: Confirmation for Data Purge / Reset */}
      {resetDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">
                {resetDialog.mode === "transactions_only" ? "Clear Demo Transactions?" : "Full Database Reset?"}
              </h3>
            </div>

            <p className="text-sm text-slate-600">
              {resetDialog.mode === "transactions_only"
                ? "This will delete all dummy sales, payment records, leads, and expenses. Your real projects and agents will be preserved."
                : "This will delete ALL projects, agents, and transactions for a 100% clean factory slate."}
            </p>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Type <span className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded">CONFIRM_RESET</span> to proceed:
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                className={inputCls}
                placeholder="CONFIRM_RESET"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResetDialog({ open: false, mode: "" });
                  setConfirmPhrase("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={executeDataReset}
                disabled={busy || confirmPhrase !== "CONFIRM_RESET"}
                className={resetDialog.mode === "transactions_only" ? "bg-amber-700 hover:bg-amber-800" : "bg-red-700 hover:bg-red-800"}
              >
                {busy ? "Purging..." : "Confirm & Execute Purge"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MerlinFlow Technologies Platform Credit */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-500">
          Nest Infra CRM Enterprise Edition · Powered by{" "}
          <strong className="text-slate-800 font-semibold">MerlinFlow Technologies Pvt. Ltd.</strong>
        </p>
      </div>
    </div>
  );
}
