import React, { useState, useEffect } from "react";
import api, { errMsg } from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Printer, Download, CheckCircle, Building2, MapPin, Phone, Mail, FileText } from "lucide-react";
import { toast } from "sonner";

export default function PaymentReceiptModal({ paymentId, open, onOpenChange }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!paymentId || !open) return;
    setLoading(true);
    api
      .get(`/payments/${paymentId}/receipt`)
      .then((res) => setReceipt(res.data))
      .catch((err) => {
        console.error(err);
        toast.error(errMsg(err) || "Failed to load payment receipt");
      })
      .finally(() => setLoading(false));
  }, [paymentId, open]);

  const handlePrint = () => {
    window.print();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6 printable-dialog">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
          </div>
        ) : receipt ? (
          <div className="space-y-6 print:p-0">
            {/* Header Action Bar */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-slate-800">Official Payment Receipt</span>
              </div>
              <Button onClick={handlePrint} size="sm" className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </Button>
            </div>

            {/* Printable Voucher Box */}
            <div id="receipt-print-area" className="rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm print:border-none print:shadow-none print:p-2">
              {/* Company Branding */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{receipt.company.name}</h2>
                  <p className="text-xs font-semibold text-emerald-700 tracking-wide mt-0.5">{receipt.company.tagline}</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm leading-relaxed">{receipt.company.address}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span>GSTIN: <strong className="text-slate-700">{receipt.company.gstin}</strong></span>
                    <span>Ph: {receipt.company.phone}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">RECEIPT NO.</span>
                  <p className="text-base font-black text-slate-900 font-num">{receipt.receipt_number}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 block">DATE</span>
                  <p className="text-xs font-semibold text-slate-700">{receipt.date}</p>
                </div>
              </div>

              {/* Receipt Title */}
              <div className="my-4 text-center">
                <span className="inline-block rounded-md bg-emerald-50 px-4 py-1 text-xs font-extrabold uppercase tracking-widest text-emerald-800 border border-emerald-200">
                  Payment Acknowledgment Receipt
                </span>
              </div>

              {/* Customer & Plot Matrix */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs border border-slate-200">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Received From</p>
                  <p className="text-sm font-bold text-slate-900">{receipt.customer_name}</p>
                  {receipt.customer_mobile && <p className="text-slate-600">Mobile: {receipt.customer_mobile}</p>}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project & Plot</p>
                  <p className="text-sm font-bold text-slate-900">{receipt.project_name}</p>
                  <p className="text-slate-600 font-semibold">Plot No: <span className="text-slate-900 font-bold">#{receipt.plot_number}</span></p>
                </div>
              </div>

              {/* Amount Breakdown Table */}
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Payment Description</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Ref / UTR</th>
                      <th className="p-3 text-right">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">
                        {receipt.reference || `Plot #${receipt.plot_number} installment collection`}
                      </td>
                      <td className="p-3">
                        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-bold uppercase text-[10px]">
                          {receipt.mode}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{receipt.reference || "-"}</td>
                      <td className="p-3 text-right font-num font-bold text-sm text-slate-900">
                        ₹{receipt.amount.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in words */}
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount in Words:</span>
                <p className="font-semibold text-slate-900 italic mt-0.5">{receipt.amount_in_words}</p>
              </div>

              {/* Ledger Summary */}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-b border-slate-200 py-3 text-center text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total Deal Value</span>
                  <p className="font-bold text-slate-900 font-num mt-0.5">₹{receipt.sale_total_amount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total Paid to Date</span>
                  <p className="font-bold text-emerald-700 font-num mt-0.5">₹{receipt.total_paid_to_date.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Remaining Balance</span>
                  <p className="font-bold text-rose-700 font-num mt-0.5">₹{receipt.balance_remaining.toLocaleString()}</p>
                </div>
              </div>

              {/* Authorized Signatory & Note */}
              <div className="mt-8 flex items-end justify-between text-xs text-slate-500">
                <div>
                  <p className="text-[10px] italic text-slate-400 max-w-xs">
                    * This is a computer generated receipt. Subject to realization of Cheque / Online Transfer.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Received By: <strong>{receipt.received_by}</strong></p>
                </div>
                <div className="text-center">
                  <div className="h-12 border-b border-slate-300 w-36 mb-1"></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Authorized Signatory</span>
                </div>
              </div>

              {/* Software Attribution */}
              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 print:text-[8px]">
                <span>Nest Infra Developers CRM System</span>
                <span>Powered by <strong className="text-slate-600">MerlinFlow Technologies Pvt. Ltd.</strong></span>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
