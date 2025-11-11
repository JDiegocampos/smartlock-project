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
