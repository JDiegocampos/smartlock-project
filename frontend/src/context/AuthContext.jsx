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
import { tokenChallenge, token2faVerify } from "../api/auth";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const t = getAccessToken();
    return t ? decodeToken(t) : null;
  });
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
      const res = await tokenChallenge(username, password);
      // Esperamos 202 con challenge
      if (res.status === 202 && res.data?.["2fa_required"]) {
        const { challenge, must_setup, otpauth_url } = res.data;
        setLoading(false);
        return { success: false, twoFactorRequired: true, challenge, must_setup: !!must_setup, otpauth_url: otpauth_url || null };
      }
      // Si por alguna razón el backend cambia y devuelve tokens, los manejamos igual
      if (res.data?.access && res.data?.refresh) {
        setTokens({ access: res.data.access, refresh: res.data.refresh });
        setUser(decodeToken(res.data.access));
        setLoading(false);
        return { success: true };
      }
      setLoading(false);
      return { success: false, error: "Respuesta inesperada del servidor." };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.response?.data || err.message };
    }
  };

  // Paso 2: verificamos challenge + TOTP y guardamos tokens
  const verify2fa = async (challenge, code) => {
    setLoading(true);
    try {
      const res = await token2faVerify(challenge, code);
      const { access, refresh } = res.data;
      setTokens({ access, refresh });
      setUser(decodeToken(access));
      setLoading(false);
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
    <AuthContext.Provider value={{ user, loading, login, verify2fa, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};
