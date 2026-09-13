import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { errMsg } from "../lib/api";
import ImageUploadField from "./ImageUploadField";

export const inputCls =
  "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1";

export function PageHeader({ title, sub, children, testid }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-6" data-testid={testid}>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 truncate">{title}</h1>
        {sub && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, sub, tone = "default", testid }) {
  const tones = {
    default: "text-slate-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  };
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm transition-shadow duration-200 hover:shadow-md min-w-0"
      data-testid={testid}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 truncate">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-400 shrink-0" />}
      </div>
      <p className={`mt-1 sm:mt-2 text-lg sm:text-2xl font-bold font-num tracking-tight truncate ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] sm:text-xs text-slate-500 truncate">{sub}</p>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    available: "bg-green-100 text-green-800 border-green-300",
    active: "bg-green-100 text-green-800 border-green-300",
    paid: "bg-green-100 text-green-800 border-green-300",
    booked: "bg-amber-100 text-amber-800 border-amber-300",
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    sold: "bg-red-100 text-red-800 border-red-300",
    cancelled: "bg-slate-100 text-slate-600 border-slate-300",
    inactive: "bg-slate-100 text-slate-600 border-slate-300",
  };
  const cls = map[(status || "").toLowerCase()] || "bg-slate-100 text-slate-600 border-slate-300";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function DataTable({ columns, rows, testid, onRowClick, empty = "No records found" }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm" data-testid={testid}>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={`text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-slate-400">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, i) => (
              <TableRow
                key={r.id || i}
                className={`transition-colors duration-150 hover:bg-slate-50 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick && onRowClick(r)}
                data-testid={`${testid}-row-${i}`}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={`whitespace-nowrap text-sm text-slate-700 ${
                      c.align === "right" ? "text-right font-num" : ""
                    }`}
                  >
                    {c.render ? c.render(r) : r[c.key] ?? "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function FormDialog({ open, onOpenChange, onClose, title, fields, initial, onSubmit, submitLabel = "Save", testid }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setValues(initial || {});
  }, [open, initial]);
  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const handleClose = (o) => {
    if (onOpenChange) onOpenChange(o);
    if (!o && onClose) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(values);
      handleClose(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid={testid}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          {fields.map((fl) => (
            <div key={fl.name} className={fl.full ? "col-span-2" : "col-span-2 sm:col-span-1"}>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {fl.label}
                {fl.required ? " *" : ""}
              </Label>
              {fl.type === "image" ? (
                <div className="mt-1">
                  <ImageUploadField
                    value={values[fl.name] ?? ""}
                    onChange={(val) => set(fl.name, val)}
                    label={fl.label}
                    hint={fl.hint}
                    required={fl.required}
                  />
                </div>
              ) : fl.type === "select" ? (
                <select
                  className={`${inputCls} mt-1.5`}
                  value={values[fl.name] ?? ""}
                  onChange={(e) => set(fl.name, e.target.value)}
                  required={fl.required}
                  data-testid={`${testid}-field-${fl.name}`}
                >
                  <option value="">{fl.placeholder || "Select..."}</option>
                  {(fl.options || []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : fl.type === "textarea" ? (
                <Textarea
                  className="mt-1.5"
                  value={values[fl.name] ?? ""}
                  onChange={(e) => set(fl.name, e.target.value)}
                  placeholder={fl.placeholder}
                  data-testid={`${testid}-field-${fl.name}`}
                />
              ) : (
                <Input
                  className="mt-1.5"
                  type={fl.type || "text"}
                  step={fl.type === "number" ? "any" : undefined}
                  value={values[fl.name] ?? ""}
                  onChange={(e) => set(fl.name, e.target.value)}
                  required={fl.required}
                  placeholder={fl.placeholder}
                  data-testid={`${testid}-field-${fl.name}`}
                />
              )}
              {fl.hint && <p className="mt-1 text-xs text-slate-400">{fl.hint}</p>}
            </div>
          ))}
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800" data-testid={`${testid}-submit`}>
              {busy ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, message, onConfirm, testid }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid={testid}>
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            data-testid={`${testid}-confirm`}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (err) {
                toast.error(errMsg(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
