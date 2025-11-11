// src/context/AuthContext.jsx
import React, { createContext, useEffect, useState } from "react";
import api from "../api/axiosClient";
import {
  setTokens,
  getAccessToken,
  decodeToken,
  isAccessTokenExpired,
  getRefreshToken,
  clearTokens,
} from "../utils/tokenUtils";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // ahora cargamos profile desde API
  const [loading, setLoading] = useState(false);

  // helper: obtener profile desde backend
  const fetchProfile = async () => {
    try {
      const res = await api.get("lock-users/me/");
      // res.data debe tener { id, username, email, ... }
      setUser(res.data);
      return res.data;
    } catch (err) {
      // si falla (token inválido), limpiamos sesión
      clearTokens();
      setUser(null);
      return null;
    }
  };

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.post("token/", { username, password });
      const { access, refresh } = res.data;
      setTokens({ access, refresh });

      // ahora que tenemos tokens, vamos por el profile real
      const profile = await fetchProfile();
      setLoading(false);

      if (!profile) return { success: false, error: "No se pudo obtener perfil" };
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.response?.data || err.message };
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      await api.post("users/register/", payload);
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.response?.data || err.message };
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  // Al montar: si hay access token, intentar cargar profile
  useEffect(() => {
    const init = async () => {
      const access = getAccessToken();
      if (!access) return;
      try {
        await fetchProfile();
      } catch {
        // fetchProfile ya limpia tokens si falla
      }
    };
    init();
  }, []);

  // Refresh periódico (tu lógica anterior) — la dejamos igual
  useEffect(() => {
    const intv = setInterval(async () => {
      const access = getAccessToken();
      if (access && isAccessTokenExpired(access)) {
        const refresh = getRefreshToken();
        if (!refresh) {
          logout();
          return;
        }
        try {
          const r = await api.post("token/refresh/", { refresh });
          const { access: newAccess, refresh: newRefresh } = r.data;
          setTokens({ access: newAccess, refresh: newRefresh || refresh });
          // actualizar profile usando nuevo access
          await fetchProfile();
        } catch (e) {
          logout();
        }
      }
    }, 30_000);
    return () => clearInterval(intv);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};
