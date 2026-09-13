import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, UsersRound, Handshake, IndianRupee,
  Percent, Wallet, Receipt, Calculator, FileBarChart, Upload, Menu, LogOut, Landmark, UserPlus,
  SlidersHorizontal, KeyRound, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { useAuth } from "../context/AuthContext";
import ChangePasswordModal from "./ChangePasswordModal";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/leads", label: "Leads & Visits", icon: UserPlus, testid: "nav-leads" },
  { to: "/projects", label: "Projects", icon: Building2, testid: "nav-projects" },
  { to: "/agents", label: "Agents", icon: Users, admin: true, testid: "nav-agents" },
  { to: "/teams", label: "Teams", icon: UsersRound, testid: "nav-teams" },
  { to: "/sales", label: "Sales", icon: Handshake, testid: "nav-sales" },
  { to: "/payments", label: "Payments", icon: IndianRupee, testid: "nav-payments" },
  { to: "/commission", label: "Commission", icon: Percent, testid: "nav-commission" },
  { to: "/salary", label: "Salary", icon: Wallet, admin: true, testid: "nav-salary" },
  { to: "/expenses", label: "Expenses", icon: Receipt, admin: true, testid: "nav-expenses" },
  { to: "/accounts", label: "Accounts", icon: Calculator, admin: true, testid: "nav-accounts" },
  { to: "/reports", label: "Reports", icon: FileBarChart, testid: "nav-reports" },
  { to: "/admin", label: "Admin Panel & Hub", icon: SlidersHorizontal, admin: true, testid: "nav-admin" },
];

function NavItems({ user, onNavigate, suffix = "" }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV.filter((n) => !n.admin || user.role === "admin").map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          onClick={onNavigate}
          data-testid={`${n.testid}${suffix}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? "bg-emerald-700 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <n.icon className="h-4 w-4 shrink-0" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-700">
        <Landmark className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="font-display text-sm font-bold tracking-wide text-white leading-tight">NEST INFRA</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-500">Developers CRM</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);

  const userBlock = (suffix = "") => (
    <div className="border-t border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{user.name}</p>
          <p className="text-xs text-slate-400 capitalize">{user.role}{user.agent_code ? ` · ${user.agent_code}` : ""}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {user.role === "agent" && user.password_changed ? (
          <button
            onClick={() => toast.info("Your password is set and secured. For any further resets, please contact management.")}
            className="flex items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-slate-800"
          >
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> Secured
          </button>
        ) : (
          <button
            onClick={() => setPwModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <KeyRound className="h-3 w-3 text-emerald-400" /> Password
          </button>
        )}
        <button
          onClick={logout}
          data-testid={`logout-button${suffix}`}
          className="flex items-center justify-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-300"
        >
          <LogOut className="h-3 w-3" /> Sign out
        </button>
      </div>
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-center">
        <p className="text-[10px] text-slate-400 font-medium tracking-wide">
          Powered by <span className="text-slate-200 font-semibold">MerlinFlow Technologies Pvt. Ltd.</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-slate-900 md:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavItems user={user} />
        </div>
        {userBlock()}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 md:hidden shadow-md">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-emerald-700">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white leading-none">NEST INFRA CRM</p>
            <p className="text-[9px] font-medium text-emerald-400 capitalize">{user.role}{user.agent_code ? ` · ${user.agent_code}` : ""}</p>
          </div>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button aria-label="Open menu" data-testid="mobile-menu-button" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 active:bg-slate-700">
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] bg-slate-900 p-0 border-slate-800 flex flex-col h-full [&>button]:text-slate-300 [&>button]:hover:text-white">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <Brand />
            <div className="flex-1 overflow-y-auto">
              <NavItems user={user} onNavigate={() => setOpen(false)} suffix="-mobile" />
            </div>
            {userBlock("-mobile")}
          </SheetContent>
        </Sheet>
      </div>

      <main className="flex-1 md:pl-60 min-w-0 max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-7xl p-3 sm:p-5 lg:p-8 min-w-0">
          <Outlet />
        </div>
      </main>

      <ChangePasswordModal
        open={pwModalOpen}
        onOpenChange={setPwModalOpen}
        user={user}
      />
    </div>
  );
}
