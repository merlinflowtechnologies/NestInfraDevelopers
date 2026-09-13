import { useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { inr } from "../lib/format";
import { PageHeader, FormDialog, ConfirmDialog, StatusBadge } from "../components/common";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuth } from "../context/AuthContext";
import PlotLayoutView from "../components/PlotLayoutView";

const FIELDS = [
  { name: "name", label: "Project / Venture Name", required: true },
  { name: "location", label: "Location / Landmark", required: true },
  { name: "project_type", label: "Project Type", required: true, type: "select", options: [
    { value: "Open Plots", label: "Open Plots" }, { value: "Gated Community Plots", label: "Gated Community Plots" },
    { value: "Villa Plots", label: "Villa Plots" }, { value: "Apartments", label: "Apartments" }, { value: "Farmland", label: "Farmland" },
  ]},
  { name: "price", label: "Base Price (₹ / sq.yd)", type: "number", required: true },
  { name: "plot_sizes", label: "Plot Sizes (sq.yds)", placeholder: "167, 200, 267 sq.yds" },
  { name: "total_plots", label: "Total Plots Count", type: "number", required: true },
  { name: "images", label: "Venture Cover Photo", type: "image", full: true, hint: "Upload venture photo from your phone/computer or paste URL" },
  { name: "layout_image", label: "Venture Layout Map / Blueprint", type: "image", full: true, hint: "Upload DTCP/HMDA layout master plan map image" },
  { name: "map_url", label: "Google Maps Location Link", full: true, placeholder: "https://maps.google.com/..." },
  { name: "description", label: "Venture Description & Amenities", type: "textarea", full: true, placeholder: "100ft road facing, DTCP/HMDA approved, underground drainage, 24/7 security..." },
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
      images: v.images ? (Array.isArray(v.images) ? v.images : [v.images]) : [],
      layout_image: v.layout_image || "",
      map_url: v.map_url || "", description: v.description || "",
    };
    if (form.initial?.id) {
      await api.put(`/projects/${form.initial.id}`, payload);
      toast.success("Project updated successfully!");
    } else {
      await api.post("/projects", payload);
      toast.success("Project created successfully with photos!");
    }
    load();
  };

  return (
    <div data-testid="projects-page">
      <PageHeader title="Projects & Ventures" sub="Plot inventory and venture master plans across all projects" testid="projects-header">
        {isAdmin && (
          <Button className="bg-emerald-700 hover:bg-emerald-800 shadow-sm" onClick={() => setForm({ open: true, initial: null })} data-testid="add-project-button">
            <Plus className="mr-1 h-4 w-4" /> Add Venture / Project
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const pct = p.total_plots ? Math.round(((p.booked_plots + p.sold_plots) / p.total_plots) * 100) : 0;
          return (
            <div
              key={p.id}
              className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setDetail(p)}
              data-testid={`project-card-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                <img src={p.images?.[0] || PLACEHOLDER} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                {p.layout_image && (
                  <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-sm">
                    🗺️ Layout Map Attached
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-slate-900">{p.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3 text-emerald-600" /> {p.location}
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
                  <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" aria-label="Edit project" data-testid={`edit-project-${p.id}`}
                      onClick={() => setForm({ open: true, initial: { ...p, images: p.images?.[0] || "", layout_image: p.layout_image || "" } })}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Photos & Details
                    </Button>
                    <Button size="sm" variant="outline" aria-label="Delete project" className="text-red-600 hover:bg-red-50" data-testid={`delete-project-${p.id}`}
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
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="project-detail-dialog">
          {detail && (
            <>
              <div className="relative h-60 w-full overflow-hidden rounded-xl bg-slate-900">
                <img src={detail.images?.[0] || PLACEHOLDER} alt={detail.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 text-white">
                  <h2 className="font-display text-2xl font-bold">{detail.name}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-slate-200 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" /> {detail.location} · {detail.project_type}
                  </p>
                </div>
              </div>

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

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div><p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Type</p><p className="font-medium text-slate-800">{detail.project_type}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Base Price</p><p className="font-num font-semibold text-emerald-700">{inr(detail.price)} / sq.yd</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Plot Sizes</p><p className="font-medium text-slate-800">{detail.plot_sizes || "-"}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Total Plots</p><p className="font-num font-medium text-slate-800">{detail.total_plots}</p></div>
              </div>

              {detail.description && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-white p-3 text-xs leading-relaxed text-slate-700">
                  <p className="font-semibold text-slate-900 mb-1">Venture Overview & Amenities:</p>
                  {detail.description}
                </div>
              )}

              {/* Master Layout Blueprint Image if present */}
              {detail.layout_image && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      🗺️ Venture Master Layout Blueprint
                    </h3>
                    <a
                      href={detail.layout_image}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Open Full Size ↗
                    </a>
                  </div>
                  <div className="max-h-80 overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5">
                    <img
                      src={detail.layout_image}
                      alt={`${detail.name} Layout Map`}
                      className="w-full object-contain max-h-80"
                    />
                  </div>
                </div>
              )}
              
              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-slate-900">Interactive Plot Layout & Matrix</h3>
                  {detail.map_url && (
                    <a href={detail.map_url} target="_blank" rel="noreferrer" data-testid="project-map-link"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Google Maps Pin ↗
                    </a>
                  )}
                </div>
                <PlotLayoutView
                  projectId={detail.id}
                  projectName={detail.name}
                  isAdmin={isAdmin}
                  onBookPlot={(plot) => {
                    setDetail(null);
                    toast.info(`Selected Plot #${plot.plot_number} in ${plot.projectName}. Go to Sales to complete booking.`);
                  }}
                />
              </div>
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
