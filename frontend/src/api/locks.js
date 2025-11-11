// src/api/locks.js
import api from "./axiosClient";

export const listLocks = (params = {}) => api.get("locks/", { params });

export const getLock = (uuid) => api.get(`locks/${uuid}/`);

export const claimLock = (payload) => api.post("locks/claim/", payload);
// payload: { uuid, name, location }

export const updateLock = (uuid, payload) => api.patch(`locks/${uuid}/`, payload);

export const deleteLock = (uuid) => api.delete(`locks/${uuid}/`);

export const getLockNetworkConfig = (uuid) => api.get(`locks/${uuid}/network/`);
export const createLockNetworkConfig = (uuid, payload) => api.post(`locks/${uuid}/network/`, payload);
export const updateLockNetworkConfig = (uuid, payload) => api.patch(`locks/${uuid}/network/`, payload);

export default {
    getLock,
    listLocks,
    claimLock,
    updateLock,
    deleteLock,
    getLockNetworkConfig,
    createLockNetworkConfig,
    updateLockNetworkConfig,
};