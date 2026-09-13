import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Landmark } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { errMsg } from "../lib/api";

const SIDE_IMG =
  "https://images.unsplash.com/photo-1774697443203-0f54409d1613?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxhZXJpYWwlMjB2aWV3JTIwcmVzaWRlbnRpYWwlMjBwbG90cyUyMGxheW91dCUyMGluZGlhfGVufDB8fHx8MTc4NzIxMDcwOHww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="relative hidden w-1/2 lg:block">
        <img src={SIDE_IMG} alt="Nest Infra projects" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/80" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-700">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <p className="font-display text-lg font-bold tracking-wide text-white">NEST INFRA DEVELOPERS</p>
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight text-white">
              Plots. People.
              <br />
              Performance.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
              A simple CRM to track projects, agents, teams, sales, collections and commissions — built for real estate teams on the move.
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>© 2026 Nest Infra Developers</span>
            <span className="text-slate-400">
              Powered by <strong className="text-emerald-400 font-semibold">MerlinFlow Technologies Pvt. Ltd.</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm" data-testid="login-panel">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-700">
              <Landmark className="h-4 w-4 text-white" />
            </div>
            <p className="font-display text-base font-bold text-slate-900">NEST INFRA CRM</p>
          </div>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to access your account</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email or Login ID</Label>
              <Input
                className="mt-1.5"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter email or Agent ID"
                required
                data-testid="login-identifier"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</Label>
              <Input
                className="mt-1.5"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="login-password"
              />
            </div>
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="login-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-700 hover:bg-emerald-800 transition-colors duration-150"
              data-testid="login-submit-button"
            >
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* MerlinFlow Technologies Credit */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-600">
              Powered by{" "}
              <span className="font-semibold text-slate-800 tracking-wide">
                MerlinFlow Technologies Pvt. Ltd.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
