import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Projects from "./pages/Projects";
import Agents from "./pages/Agents";
import Teams from "./pages/Teams";
import Sales from "./pages/Sales";
import Payments from "./pages/Payments";
import Commission from "./pages/Commission";
import Salary from "./pages/Salary";
import Expenses from "./pages/Expenses";
import Accounts from "./pages/Accounts";
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";
import ErrorBoundary from "./components/ErrorBoundary";

const Protected = ({ children, admin, leadOrAdmin }) => {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <p className="animate-pulse font-display text-slate-400">Loading Nest Infra CRM…</p>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  if (leadOrAdmin && user.role !== "admin" && user.role !== "team_lead" && !user.is_team_lead)
    return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Layout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="projects" element={<Projects />} />
              <Route path="agents" element={<Protected leadOrAdmin><Agents /></Protected>} />
              <Route path="teams" element={<Teams />} />
              <Route path="sales" element={<Sales />} />
              <Route path="payments" element={<Payments />} />
              <Route path="commission" element={<Commission />} />
              <Route path="salary" element={<Protected admin><Salary /></Protected>} />
              <Route path="expenses" element={<Protected admin><Expenses /></Protected>} />
              <Route path="accounts" element={<Protected admin><Accounts /></Protected>} />
              <Route path="reports" element={<Reports />} />
              <Route path="admin" element={<Protected admin><AdminPanel /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
