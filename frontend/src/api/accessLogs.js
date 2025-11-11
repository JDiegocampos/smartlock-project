// src/api/accessLogs.js
import api from "./axiosClient";

export const listAccessLogs = (params = {}) => api.get("accesslogs/", { params });
// params: { lock_uuid: 'uuid' } or server-side filters
