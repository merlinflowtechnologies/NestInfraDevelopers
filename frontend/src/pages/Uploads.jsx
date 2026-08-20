import { useEffect, useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import api, { errMsg } from "../lib/api";
import { PageHeader, inputCls } from "../components/common";
import { Button } from "../components/ui/button";

const ENTITIES = [
  { value: "projects", label: "Projects" },
  { value: "agents", label: "Agents" },
  { value: "teams", label: "Teams" },
  { value: "commission", label: "Commission Structure" },
  { value: "sales", label: "Sales" },
  { value: "payments", label: "Payments / Collections" },
  { value: "salary", label: "Salary" },
  { value: "expenses", label: "Expenses" },
];

export default function Uploads() {
  const [entity, setEntity] = useState("projects");
  const [hints, setHints] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "" });

  useEffect(() => {
    api.get("/admin/upload/template-info").then((r) => setHints(r.data.columns));
  }, []);

  useEffect(() => {
    setPreview(null);
    setFile(null);
  }, [entity]);

  const doPreview = async () => {
    if (!file) return toast.error("Choose a file first");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/admin/upload/${entity}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(r.data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    const errRows = new Set([...preview.errors.map((e) => e.row), ...preview.duplicates.map((d) => d.row)]);
    const validRows = preview.rows.filter((_, i) => !errRows.has(i + 2));
    if (validRows.length === 0) return toast.error("No valid rows to import");
    setBusy(true);
    try {
      const r = await api.post(`/admin/upload/${entity}/confirm`, { rows: validRows });
      toast.success(`Imported ${r.data.inserted} records`);
      if (r.data.failed?.length) toast.warning(`${r.data.failed.length} rows failed during import`);
      setPreview(null);
      setFile(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/change-password", pwForm);
      toast.success("Password changed");
      setPwForm({ old_password: "", new_password: "" });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const rowState = (i) => {
    const rn = i + 2;
    if (preview.errors.some((e) => e.row === rn)) return "error";
    if (preview.duplicates.some((d) => d.row === rn)) return "dup";
    return "ok";
  };

  const cols = preview?.rows?.length ? Object.keys(preview.rows[0]) : [];

  return (
    <div data-testid="uploads-page">
      <PageHeader title="Admin Upload" sub="Bulk import from Excel (.xlsx) or CSV — existing data is never deleted" testid="uploads-header" />

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data Type</label>
            <select value={entity} onChange={(e) => setEntity(e.target.value)} className={inputCls + " mt-1.5"} data-testid="upload-entity-select">
              {ENTITIES.map((en) => <option key={en.value} value={en.value}>{en.label}</option>)}
            </select>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Expected columns: <span className="font-num">{hints[entity]}</span>
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">File</label>
            <label
              className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-emerald-500 hover:bg-emerald-50"
              data-testid="upload-dropzone"
            >
              <UploadCloud className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-600">{file ? file.name : "Click to choose .xlsx or .csv"}</p>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" data-testid="upload-file-input"
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <Button className="mt-3 w-full bg-slate-900 hover:bg-slate-700" disabled={!file || busy} onClick={doPreview} data-testid="upload-preview-button">
              {busy ? "Processing..." : "Upload & Preview"}
            </Button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm" data-testid="upload-preview">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {preview.valid} valid</span>
              <span className="flex items-center gap-1.5 font-medium text-red-700"><AlertTriangle className="h-4 w-4" /> {preview.errors.length} errors</span>
              <span className="flex items-center gap-1.5 font-medium text-amber-700"><Copy className="h-4 w-4" /> {preview.duplicates.length} duplicates</span>
              <span className="text-slate-400">of {preview.total} rows</span>
            </div>
            <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={busy || preview.valid === 0} onClick={doConfirm} data-testid="upload-confirm-button">
              Confirm Import ({preview.valid} rows)
            </Button>
          </div>
          {(preview.errors.length > 0 || preview.duplicates.length > 0) && (
            <div className="max-h-32 overflow-y-auto border-b border-slate-100 px-5 py-3 text-xs">
              {preview.errors.map((e, i) => <p key={`e${i}`} className="text-red-600">Row {e.row}: {e.message}</p>)}
              {preview.duplicates.map((d, i) => <p key={`d${i}`} className="text-amber-600">Row {d.row}: {d.message}</p>)}
            </div>
          )}
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">#</th>
                  {cols.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-500">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => {
                  const st = rowState(i);
                  return (
                    <tr key={`${i}-${Object.values(r).slice(0, 3).join("-")}`} className={st === "error" ? "bg-red-50" : st === "dup" ? "bg-amber-50" : ""} data-testid={`preview-row-${i}`}>
                      <td className="px-3 py-1.5 font-num text-slate-400">{i + 2}</td>
                      {cols.map((c) => <td key={c} className="whitespace-nowrap px-3 py-1.5 text-slate-700">{String(r[c] ?? "")}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm" data-testid="admin-settings">
        <h2 className="font-display text-lg font-medium text-slate-800">Admin Settings — Change Password</h2>
        <form onSubmit={changePw} className="mt-4 space-y-3">
          <input type="password" placeholder="Current password" value={pwForm.old_password} required
            onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })} className={inputCls} data-testid="change-pw-old" />
          <input type="password" placeholder="New password" value={pwForm.new_password} required minLength={6}
            onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} className={inputCls} data-testid="change-pw-new" />
          <Button type="submit" className="bg-slate-900 hover:bg-slate-700" data-testid="change-pw-submit">Change Password</Button>
        </form>
      </div>
    </div>
  );
}
