// src/api/axiosClient.js
/**
 * Axios client con interceptor de refresh automático (SimpleJWT)
 *
 * Requisitos:
 * - ../utils/tokenUtils debe exportar:
 *    getAccessToken(), getRefreshToken(), setTokens({ access, refresh }), clearTokens()
 *
 * Comportamiento:
 * - Añade Authorization Bearer <access> si hay access token.
 * - Si una respuesta retorna 401, intenta refresh usando /token/refresh/.
 * - Mientras se hace refresh, otras peticiones quedan en cola y se reintentan.
 * - Si refresh falla, se limpian tokens y se redirige a /login.
 */

import axios from "axios";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "../utils/tokenUtils";

const API_BASE = "http://localhost:8000/api/";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Inyectar access token en cada petición (si existe)
api.interceptors.request.use(
  (config) => {
    const access = getAccessToken();
    if (access) {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${access}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Lógica de refresh:
 * - isRefreshing: bandera si ya se está refrescando
 * - failedQueue: peticiones que llegaron durante el refresh; serán resueltas/rechazadas después
 */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si no hay response (network error), rechazar
    if (!error.response) {
      return Promise.reject(error);
    }

    const status = error.response.status;

    // Si no es 401, rechazar normalmente
    if (status !== 401) {
      return Promise.reject(error);
    }

    // Evitar loops: si la petición ya fue de refresh, no intentar nuevamente
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    // Marcar que vamos a reintentar esta petición
    originalRequest._retry = true;

    // Obtener refresh token actual
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      // No hay refresh: limpiar y forzar login
      clearTokens();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    // Si ya está refrescando, poner la petición en la cola
    if (isRefreshing) {
      return new Promise(function (resolve, reject) {
        failedQueue.push({
          resolve: (token) => {
            // after refresh succeeded, re-intentar original request with new token
            originalRequest.headers["Authorization"] = "Bearer " + token;
            resolve(api(originalRequest));
          },
          reject: (err) => {
            reject(err);
          },
        });
      });
    }

    // Iniciar refresh (solo una vez)
    isRefreshing = true;

    try {
      // Usamos axios (instancia sin interceptores) para el refresh
      const refreshResponse = await axios.post(API_BASE + "token/refresh/", { refresh: refreshToken }, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      const newAccess = refreshResponse.data?.access;
      const newRefresh = refreshResponse.data?.refresh ?? refreshToken;

      if (!newAccess) {
        throw new Error("Refresh no devolvió access token");
      }

      // Guardar tokens usando utilidades del proyecto
      setTokens({ access: newAccess, refresh: newRefresh });

      // Actualizar header por defecto
      api.defaults.headers.common["Authorization"] = `Bearer ${newAccess}`;

      // Procesar cola de peticiones pendientes
      processQueue(null, newAccess);

      // reintentar la petición original con el nuevo access token
      originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (err) {
      // Si falla refresh: rechazar todas las peticiones en cola, limpiar tokens y redirigir a login
      processQueue(err, null);
      clearTokens();
      // opcional: mostrar mensaje o notificación antes de redirigir
      // console.warn("Refresh failed, redirecting to login", err);
      window.location.href = "/login";
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
