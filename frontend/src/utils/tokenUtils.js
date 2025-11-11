// src/utils/tokenUtils.js
/**
 * Utilidades para manejo de JWT en el frontend
 *
 * - No depende de librerías externas (evita problemas de import).
 * - Guarda tokens en localStorage con llaves claras.
 * - Decodifica payload del JWT (base64url) de manera segura.
 * - isAccessTokenExpired() usa claim "exp" (segundos desde epoch).
 *
 * Llaves en localStorage:
 *  - access_token
 *  - refresh_token
 */

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

/**
 * Base64URL -> Base64 (padding handling) -> decode
 */
function base64UrlDecode(str) {
  if (!str) return null;
  // Replace URL-safe chars
  let output = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '=' to make length multiple of 4
  switch (output.length % 4) {
    case 2:
      output += "==";
      break;
    case 3:
      output += "=";
      break;
    default:
      break;
  }
  try {
    // atob works in browsers
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(output), (c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
  } catch (e) {
    // Fallback: try plain atob then return
    try {
      return atob(output);
    } catch (err) {
      console.error("base64UrlDecode failed", err);
      return null;
    }
  }
}

/**
 * Decodifica el payload de un JWT y devuelve el objeto (sin verificar firma).
 * @param {string} token
 * @returns {object|null}
 */
export function decodeToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const decoded = base64UrlDecode(payload);
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch (e) {
    console.error("decodeToken error", e);
    return null;
  }
}

/**
 * getAccessToken / getRefreshToken
 */
export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/**
 * setTokens: guarda access y refresh. Si alguno es undefined/null no lo sobreescribe.
 * @param {{access?: string, refresh?: string}} tokens
 */
export function setTokens(tokens = {}) {
  if (!tokens) return;
  if (tokens.access) {
    localStorage.setItem(ACCESS_KEY, tokens.access);
  }
  if (tokens.refresh) {
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  }
}

/**
 * clearTokens: elimina tokens
 */
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/**
 * isAccessTokenExpired: comprueba el claim "exp" (segundos).
 * Devuelve true si el token está expirado o no se puede leer.
 * Se puede pasar un token opcional; si no se pasa usa el guardado en localStorage.
 * Opcionalmente añade leeway (segundos) para prevenir edge cases (default 30s).
 *
 * @param {string|null} token
 * @param {number} leewaySeconds
 * @returns {boolean}
 */
export function isAccessTokenExpired(token = null, leewaySeconds = 30) {
  const t = token || getAccessToken();
  if (!t) return true;
  const payload = decodeToken(t);
  if (!payload) return true;
  const exp = payload.exp;
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now + leewaySeconds >= Number(exp);
}

/**
 * Helper: get user info from access token payload (if available).
 * Útil para poblar user en AuthContext sin llamar al backend.
 * Retorna null si no hay token o no tiene info.
 */
export function getUserFromAccessToken(token = null) {
  const t = token || getAccessToken();
  if (!t) return null;
  const payload = decodeToken(t);
  if (!payload) return null;
  // Los claim names pueden variar; retornamos el payload entero para que el AuthContext decida.
  return payload;
}

/* Export por defecto (opcional) */
export default {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  decodeToken,
  isAccessTokenExpired,
  getUserFromAccessToken,
};
