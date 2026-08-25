import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore from localStorage, validate token
  useEffect(() => {
    const token = localStorage.getItem("givt_token");
    const saved = localStorage.getItem("givt_user");
    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }
    if (token) {
      authAPI.me()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("givt_user", JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem("givt_token");
          localStorage.removeItem("givt_user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem("givt_token", token);
    localStorage.setItem("givt_user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("givt_token");
    localStorage.removeItem("givt_user");
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("givt_user", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
