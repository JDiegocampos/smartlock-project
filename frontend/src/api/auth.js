// src/api/auth.js
import api from "./axiosClient";

export const login = (username, password) => {
  return api.post("token/", { username, password });
};

export const refreshToken = (refresh) => {
  return api.post("token/refresh/", { refresh });
};

export const registerUser = ({ username, email, password }) => {
  return api.post("users/register/", { username, email, password });
};

export const getMe = () => {
  return api.get("users/me/");
};

// challenge con username/password
export const tokenChallenge = (username, password) => {
  return api.post("token/2fa-challenge/", { username, password });
};

// verify desafío con código TOTP
export const token2faVerify = (challenge, code) => {
  return api.post("token/2fa-verify/", { challenge, code });
};

// 2FA setup (requiere auth)
export const twoFASetup = () => api.post("users/2fa/setup/");
export const twoFAConfirm = (code) => api.post("users/2fa/confirm/", { code });
export const twoFADisable = (code) => api.post("users/2fa/disable/", { code });

export default {
  tokenChallenge,
  token2faVerify,
  twoFASetup,
  twoFAConfirm,
  twoFADisable,
};