import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out

  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setUser(false));
  }, []);

  const login = async (identifier, password) => {
    const r = await api.post("/auth/login", { identifier, password });
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* session already gone */
    }
    setUser(false);
    window.location.href = "/login";
  };

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}
