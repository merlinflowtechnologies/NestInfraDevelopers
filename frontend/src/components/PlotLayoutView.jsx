import React, { useState, useEffect } from "react";
import api, { errMsg } from "../lib/api";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { MapPin, User, Phone, Calendar, IndianRupee, Compass, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PlotLayoutView({ projectId, projectName, onBookPlot, isAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | available | booked | sold
  const [selectedPlot, setSelectedPlot] = useState(null);

  const fetchPlots = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}/plots`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to load plot layout details");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPlots();
  }, [fetchPlots]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const plots = data.plots || [];
  const filteredPlots = plots.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "available":
        return "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400";
      case "booked":
        return "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400";
      case "sold":
        return "bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100 hover:border-rose-400";
      default:
        return "bg-slate-50 border-slate-300 text-slate-700";
    }
  };

  const getBadgeVariant = (status) => {
    switch (status) {
      case "available":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "booked":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "sold":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Stats & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className="rounded-full text-xs h-8 px-2.5 sm:px-3"
          >
            All Plots ({data.total_plots})
          </Button>
          <Button
            size="sm"
            variant={filter === "available" ? "default" : "outline"}
            onClick={() => setFilter("available")}
            className="rounded-full text-xs h-8 px-2.5 sm:px-3 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
          >
            🟢 Available ({data.available_plots})
          </Button>
          <Button
            size="sm"
            variant={filter === "booked" ? "default" : "outline"}
            onClick={() => setFilter("booked")}
            className="rounded-full text-xs h-8 px-2.5 sm:px-3 border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
          >
            🟡 Booked ({data.booked_plots})
          </Button>
          <Button
            size="sm"
            variant={filter === "sold" ? "default" : "outline"}
            onClick={() => setFilter("sold")}
            className="rounded-full text-xs h-8 px-2.5 sm:px-3 border-rose-300 text-rose-800 hover:bg-rose-100 hover:text-rose-900"
          >
            🔴 Sold ({data.sold_plots})
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span> Available</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span> Booked</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block"></span> Sold</span>
        </div>
      </div>

      {/* Interactive Grid Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-2.5 max-h-[460px] overflow-y-auto p-1">
          {filteredPlots.map((plot) => (
            <button
              key={plot.plot_number}
              onClick={() => setSelectedPlot(plot)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all transform hover:scale-105 active:scale-95 shadow-sm text-left min-h-[64px] ${getStatusColor(
                plot.status
              )}`}
            >
              <span className="text-xs font-bold">#{plot.plot_number}</span>
              <span className="text-[10px] font-medium opacity-85 mt-0.5">{plot.size_sqyd} sqyd</span>
              <span className="text-[9px] uppercase tracking-wider opacity-75 mt-0.5">{plot.facing.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        {filteredPlots.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-400">No plots match the selected filter.</p>
        )}
      </div>

      {/* Plot Details Modal */}
      <Dialog open={!!selectedPlot} onOpenChange={() => setSelectedPlot(null)}>
        <DialogContent className="max-w-md">
          {selectedPlot && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    Plot #{selectedPlot.plot_number}
                  </DialogTitle>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${getBadgeVariant(
                      selectedPlot.status
                    )}`}
                  >
                    {selectedPlot.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {data.project_name}
                </p>
              </DialogHeader>

              {/* Plot Specs */}
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Area
                  </p>
                  <p className="font-semibold text-slate-800">{selectedPlot.size_sqyd} Sq. Yards</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <Compass className="h-3 w-3" /> Facing
                  </p>
                  <p className="font-semibold text-slate-800">{selectedPlot.facing}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> Rate / Sq.yd
                  </p>
                  <p className="font-semibold text-slate-800">₹{selectedPlot.price_per_yd.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> Total Value
                  </p>
                  <p className="font-bold text-emerald-700 font-num">₹{selectedPlot.total_price.toLocaleString()}</p>
                </div>
              </div>

              {/* Booking Info if Booked/Sold */}
              {selectedPlot.status !== "available" && (
                <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs">
                  <p className="font-bold text-slate-800 border-b border-amber-200 pb-1 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-amber-700" /> Customer & Booking Details
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400">Customer:</span>
                      <p className="font-semibold">{selectedPlot.customer_name || "-"}</p>
                    </div>
                    {selectedPlot.customer_mobile && (
                      <div>
                        <span className="text-slate-400">Mobile:</span>
                        <p className="font-semibold">{selectedPlot.customer_mobile}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400">Booked By:</span>
                      <p className="font-semibold">{selectedPlot.agent_name || selectedPlot.agent_code || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Booking Date:</span>
                      <p className="font-semibold">{selectedPlot.booking_date || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Paid:</span>
                      <p className="font-semibold text-emerald-700">₹{selectedPlot.amount_collected.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Balance:</span>
                      <p className="font-semibold text-rose-700">₹{selectedPlot.balance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedPlot(null)}>
                  Close
                </Button>
                {selectedPlot.status === "available" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    onClick={() => {
                      const plotCopy = { ...selectedPlot, projectId: data.project_id, projectName: data.project_name };
                      setSelectedPlot(null);
                      if (onBookPlot) onBookPlot(plotCopy);
                    }}
                  >
                    Book Plot #{selectedPlot.plot_number}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
