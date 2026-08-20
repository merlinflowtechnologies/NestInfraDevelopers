import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Building2, Users, UsersRound, Handshake, IndianRupee,
  Percent, Wallet, Receipt, Calculator, FileBarChart, Upload, Menu, LogOut, Landmark,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
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
  { to: "/admin", label: "Admin Upload", icon: Upload, admin: true, testid: "nav-admin" },
];

function NavItems({ user, onNavigate }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV.filter((n) => !n.admin || user.role === "admin").map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          onClick={onNavigate}
          data-testid={n.testid}
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

  const userBlock = (
    <div className="border-t border-slate-800 p-4">
      <p className="text-sm font-semibold text-white">{user.name}</p>
      <p className="text-xs text-slate-400 capitalize">{user.role}{user.agent_code ? ` · ${user.agent_code}` : ""}</p>
      <button
        onClick={logout}
        data-testid="logout-button"
        className="mt-3 flex w-full items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition-colors duration-150 hover:bg-slate-800 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-slate-900 md:flex">
        <Brand />
        <NavItems user={user} />
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-emerald-700">
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <p className="font-display text-sm font-bold text-white">NEST INFRA CRM</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button aria-label="Open menu" data-testid="mobile-menu-button" className="rounded-md p-2 text-slate-300 hover:bg-slate-800">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-slate-900 p-0 border-slate-800 flex flex-col">
            <Brand />
            <NavItems user={user} onNavigate={() => setOpen(false)} />
            {userBlock}
          </SheetContent>
        </Sheet>
      </div>

      <main className="md:pl-60">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
