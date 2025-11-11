// src/api/users.js
import api from "./axiosClient";

export const listUsers = (params = {}) => api.get("users/", { params }); // acepta { search: 'x' }
export const getRoles = () => api.get("roles/");

export const listUserRoles = (params = {}) => api.get("user-roles/", { params });

export const assignUserRole = (payload) => api.post("user-roles/", payload);

export const updateUserRole = (id, payload) => api.patch(`user-roles/${id}/`, payload);

export const deleteUserRole = (id) => api.delete(`user-roles/${id}/`);
