import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("token");
        setUser(false);
      });
  }, []);

  const login = async (identifier, password) => {
    const r = await api.post("/auth/login", { identifier, password });
    if (r.data?.token) {
      localStorage.setItem("token", r.data.token);
    }
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* session already gone */
    }
    localStorage.removeItem("token");
    setUser(false);
    window.location.href = "/login";
  };

  const isAdmin = Boolean(user && user.role === "admin");
  const isLead = Boolean(user && (user.role === "team_lead" || user.is_team_lead));
  const isAgent = Boolean(user && user.role === "agent" && !user.is_team_lead);
  const canManageTeam = Boolean(isAdmin || isLead);

  return (
    <AuthCtx.Provider value={{ user, isAdmin, isLead, isAgent, canManageTeam, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
