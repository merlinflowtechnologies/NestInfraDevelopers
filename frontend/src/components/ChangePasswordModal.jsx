import React, { useState } from "react";
import { KeyRound, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import api, { errMsg } from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { inputCls } from "./common";

export default function ChangePasswordModal({ open, onOpenChange, user }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters long.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("New password and confirmation do not match.");
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      toast.success("Password changed successfully! Please use your new password next time.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(errMsg(err) || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            Change Your Password
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            {user?.role === "agent"
              ? "Update your default common password to a private password of your choice."
              : "Update your administrative login password."}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Current / Common Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="e.g. nest@123"
              className={inputCls + " mt-1"}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">New Password (Min 6 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new strong password"
              className={inputCls + " mt-1"}
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className={inputCls + " mt-1"}
              minLength={6}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
