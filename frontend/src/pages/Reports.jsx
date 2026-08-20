import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { toast } from "sonner";
import api, { downloadFile, errMsg } from "../lib/api";
import { inr } from "../lib/format";
import { PageHeader, inputCls } from "../components/common";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";

const REPORTS = [
  { value: "sales", label: "Monthly Sales Report" },
  { value: "agent-sales", label: "Agent Sales Report" },
  { value: "team-sales", label: "Team Sales Report" },
  { value: "commission", label: "Commission Report" },
  { value: "salary", label: "Salary Report", admin: true },
  { value: "expenses", label: "Expense Report", admin: true },
  { value: "collections", label: "Collection Report" },
  { value: "projects", label: "Project Report" },
  { value: "profit-summary", label: "Monthly Profit Summary", admin: true },
];

const MONEY_KEYS = ["Sale Amount", "Collected", "Balance", "Sales", "Collection", "Commission", "Amount", "Basic", "Bonus", "Deduction", "Net Salary", "Price", "Sales Value", "Outstanding", "Salaries", "Expenses", "Estimated Profit", "Collections", "Eligible Amount", "Agent Commission", "Agent Paid", "Agent Pending", "Team/Leader Commission", "Team Paid", "Team Pending"];

const PRINT_CSS =
  "body{font-family:sans-serif;padding:24px}h1{font-size:18px}p{color:#666;font-size:12px}" +
  "table{border-collapse:collapse;width:100%;margin-top:16px}" +
  "td,th{border:1px solid #cbd5e1;padding:6px 8px;font-size:12px;text-align:left}th{background:#f1f5f9}";

function buildPrintDocument(doc, title, cols, rows, fmtCell) {
  const style = doc.createElement("style");
  style.textContent = PRINT_CSS;
  doc.head.appendChild(style);

  const h1 = doc.createElement("h1");
  h1.textContent = `NEST INFRA DEVELOPERS — ${title}`;
  const meta = doc.createElement("p");
  meta.textContent = `Generated: ${new Date().toLocaleString("en-IN")}`;

  const table = doc.createElement("table");
  const headRow = doc.createElement("tr");
  cols.forEach((c) => {
    const th = doc.createElement("th");
    th.textContent = c;
    headRow.appendChild(th);
  });
  const thead = doc.createElement("thead");
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement("tbody");
  rows.forEach((r) => {
    const tr = doc.createElement("tr");
    cols.forEach((c) => {
      const td = doc.createElement("td");
      td.textContent = fmtCell(c, r[c]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  doc.body.appendChild(h1);
  doc.body.appendChild(meta);
  doc.body.appendChild(table);
}

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [rtype, setRtype] = useState("sales");
  const [month, setMonth] = useState("");
  const [agent, setAgent] = useState("");
  const [team, setTeam] = useState("");
  const [project, setProject] = useState("");
  const [agents, setAgents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/projects").then((r) => setProjects(r.data));
    api.get("/teams").then((r) => setTeams(r.data));
    if (isAdmin) api.get("/agents").then((r) => setAgents(r.data));
  }, [isAdmin]);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (month) p.set("month", month);
    if (agent) p.set("agent", agent);
    if (team) p.set("team", team);
    if (project) p.set("project", project);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [month, agent, team, project]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.get(`/reports/${rtype}${qs()}`);
      setRows(r.data.rows);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [rtype, qs]);

  useEffect(() => {
    setRows(null);
  }, [rtype]);

  const visibleReports = REPORTS.filter((r) => !r.admin || isAdmin);
  const label = visibleReports.find((r) => r.value === rtype)?.label || rtype;
  const cols = rows && rows.length ? Object.keys(rows[0]) : [];
  const fmtCell = (k, v) => (MONEY_KEYS.includes(k) && typeof v === "number" ? inr(v) : String(v ?? "-"));
  const rowKey = (r, i) => `${i}-${cols.map((c) => String(r[c])).join("|")}`;

  const printReport = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    buildPrintDocument(w.document, label, cols, rows, fmtCell);
    w.print();
  };

  return (
    <div data-testid="reports-page">
      <PageHeader title="Reports" sub="Generate, export and print reports" testid="reports-header" />

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={rtype} onChange={(e) => setRtype(e.target.value)} className={inputCls} data-testid="report-type-select">
            {visibleReports.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <input type="month" value={rtype === "profit-summary" ? "" : month} disabled={rtype === "profit-summary"}
            onChange={(e) => setMonth(e.target.value)} className={inputCls + (rtype === "profit-summary" ? " opacity-40" : "")} data-testid="report-month-filter" />
          <select value={agent} onChange={(e) => setAgent(e.target.value)} className={inputCls} data-testid="report-agent-filter">
            <option value="">All Agents</option>
            {agents.map((a) => <option key={a.agent_code} value={a.agent_code}>{a.name}</option>)}
          </select>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className={inputCls} data-testid="report-team-filter">
            <option value="">All Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={project} onChange={(e) => setProject(e.target.value)} className={inputCls} data-testid="report-project-filter">
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={load} disabled={busy} className="bg-slate-900 hover:bg-slate-700" data-testid="report-generate-button">
            {busy ? "Loading..." : "Generate Report"}
          </Button>
          {rows && (
            <>
              <Button variant="outline" data-testid="report-export-csv" onClick={() => downloadFile(`/reports/${rtype}${qs()}${qs() ? "&" : "?"}format=csv`, `${rtype}.csv`)}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" data-testid="report-export-excel" onClick={() => downloadFile(`/reports/${rtype}${qs()}${qs() ? "&" : "?"}format=xlsx`, `${rtype}.xlsx`)}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" data-testid="report-print" onClick={printReport}>
                <Printer className="mr-1 h-4 w-4" /> Print
              </Button>
            </>
          )}
        </div>
      </div>

      {rows && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm" data-testid="report-result">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {cols.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-10 text-center text-slate-400">No data for selected filters</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={rowKey(r, i)} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`report-row-${i}`}>
                    {cols.map((c) => (
                      <td key={c} className={`whitespace-nowrap px-4 py-2.5 ${typeof r[c] === "number" ? "text-right font-num" : "text-slate-700"}`}>
                        {fmtCell(c, r[c])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
