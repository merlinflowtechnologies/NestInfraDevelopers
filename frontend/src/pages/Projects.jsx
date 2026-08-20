import { useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, StatusBadge } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";

const FIELDS = [
  { name: "name", label: "Project Name", required: true },
  { name: "location", label: "Location", required: true },
  { name: "project_type", label: "Project Type", required: true, type: "select", options: [
    { value: "Open Plots", label: "Open Plots" }, { value: "Gated Community Plots", label: "Gated Community Plots" },
    { value: "Villa Plots", label: "Villa Plots" }, { value: "Apartments", label: "Apartments" }, { value: "Farmland", label: "Farmland" },
  ]},
  { name: "price", label: "Price (₹ / sq.yd)", type: "number", required: true },
  { name: "plot_sizes", label: "Plot Sizes", placeholder: "167, 200, 267 sq.yds" },
  { name: "total_plots", label: "Total Plots", type: "number", required: true },
  { name: "images", label: "Image URL", full: true, placeholder: "https://... (one URL)" },
  { name: "map_url", label: "Google Map Link", full: true, placeholder: "https://maps.google.com/..." },
  { name: "description", label: "Description", type: "textarea", full: true },
];

const PLACEHOLDER = "https://images.unsplash.com/photo-1589473933604-5c3aa659adc0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxhZXJpYWwlMjB2aWV3JTIwcmVzaWRlbnRpYWwlMjBwbG90cyUyMGxheW91dCUyMGluZGlhfGVufDB8fHx8MTc4NzIxMDcwOHww&ixlib=rb-4.1.0&q=85";

export default function Projects() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const [projects, setProjects] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);

  const load = () => api.get("/projects").then((r) => setProjects(r.data));
  useEffect(() => {
    load();
  }, []);

  const submit = async (v) => {
    const payload = {
      name: v.name, location: v.location, project_type: v.project_type,
      price: parseFloat(v.price) || 0, plot_sizes: v.plot_sizes || "",
      total_plots: parseInt(v.total_plots) || 0,
      images: v.images ? [v.images] : [],
      map_url: v.map_url || "", description: v.description || "",
    };
    if (form.initial?.id) {
      await api.put(`/projects/${form.initial.id}`, payload);
      toast.success("Project updated");
    } else {
      await api.post("/projects", payload);
      toast.success("Project created");
    }
    load();
  };

  return (
    <div data-testid="projects-page">
      <PageHeader title="Projects" sub="Plot inventory across all projects" testid="projects-header">
        {isAdmin && (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setForm({ open: true, initial: null })} data-testid="add-project-button">
            <Plus className="mr-1 h-4 w-4" /> Add Project
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const pct = p.total_plots ? Math.round(((p.booked_plots + p.sold_plots) / p.total_plots) * 100) : 0;
          return (
            <div
              key={p.id}
              className="cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setDetail(p)}
              data-testid={`project-card-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <img src={p.images?.[0] || PLACEHOLDER} alt={p.name} className="h-44 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-slate-900">{p.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" /> {p.location}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{p.project_type}</span>
                </div>
                <p className="mt-2 font-num text-sm font-semibold text-emerald-700">{inr(p.price)} / sq.yd</p>
                <p className="mt-1 text-xs text-slate-500">Sizes: {p.plot_sizes || "-"}</p>
                <div className="mt-3 flex gap-2 text-xs font-semibold">
                  <span className="rounded-md border border-green-300 bg-green-100 px-2 py-0.5 text-green-800">{p.available_plots} Available</span>
                  <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-amber-800">{p.booked_plots} Booked</span>
                  <span className="rounded-md border border-red-300 bg-red-100 px-2 py-0.5 text-red-800">{p.sold_plots} Sold</span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{pct}% of {p.total_plots} plots booked/sold</p>
                {isAdmin && (
                  <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" aria-label="Edit project" data-testid={`edit-project-${p.id}`}
                      onClick={() => setForm({ open: true, initial: { ...p, images: p.images?.[0] || "" } })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" aria-label="Delete project" className="text-red-600" data-testid={`delete-project-${p.id}`}
                      onClick={() => setDel(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {projects.length === 0 && <p className="py-16 text-center text-sm text-slate-400">No projects yet</p>}

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="project-detail-dialog">
          {detail && (
            <>
              <img src={detail.images?.[0] || PLACEHOLDER} alt={detail.name} className="h-56 w-full rounded-lg object-cover" />
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{detail.name}</DialogTitle>
              </DialogHeader>
              <p className="flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {detail.location}</p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="font-num text-xl font-bold text-green-700">{detail.available_plots}</p>
                  <p className="text-xs font-semibold text-green-700">Available</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="font-num text-xl font-bold text-amber-700">{detail.booked_plots}</p>
                  <p className="text-xs font-semibold text-amber-700">Booked</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="font-num text-xl font-bold text-red-700">{detail.sold_plots}</p>
                  <p className="text-xs font-semibold text-red-700">Sold</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs uppercase tracking-wide text-slate-400">Type</p><p className="font-medium">{detail.project_type}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-400">Price</p><p className="font-num font-medium">{inr(detail.price)} / sq.yd</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-400">Plot Sizes</p><p className="font-medium">{detail.plot_sizes || "-"}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-400">Total Plots</p><p className="font-num font-medium">{detail.total_plots}</p></div>
              </div>
              {detail.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{detail.description}</p>}
              {detail.map_url && (
                <a href={detail.map_url} target="_blank" rel="noreferrer" data-testid="project-map-link"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700">
                  <MapPin className="h-4 w-4" /> View on Google Maps
                </a>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <FormDialog
        open={form.open}
        onOpenChange={(o) => setForm({ open: o, initial: null })}
        title={form.initial ? "Edit Project" : "Add Project"}
        fields={FIELDS}
        initial={form.initial}
        onSubmit={submit}
        testid="project-form"
      />
      <ConfirmDialog
        open={!!del}
        onOpenChange={() => setDel(null)}
        title="Delete Project"
        message={`Delete ${del?.name}? Projects with active sales cannot be deleted.`}
        onConfirm={async () => {
          await api.delete(`/projects/${del.id}`);
          toast.success("Project deleted");
          load();
        }}
        testid="project-delete-confirm"
      />
    </div>
  );
}
