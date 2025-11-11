// src/api/devices.js
import api from "./axiosClient";

/**
 * Devices API helpers
 *
 * listDevices(params)            -> GET /api/devices/?...
 * getDevice(id)                 -> GET /api/devices/{id}/
 * createDevice(payload)         -> POST /api/devices/
 * updateDevice(id, payload)     -> PATCH /api/devices/{id}/
 * deleteDevice(id)              -> DELETE /api/devices/{id}/
 * regenerateDeviceApiKey(id)    -> POST /api/devices/{id}/regenerate_api_key/
 *
 * payload examples:
 *  { lock: 1, device_type: "MOBILE", uid: "BTH-1234", name: "Teléfono Juan" }
 */

export const listDevices = (params = {}) => {
  return api.get("devices/", { params });
};

export const getDevice = (id) => {
  return api.get(`devices/${id}/`);
};

export const createDevice = (payload) => {
  return api.post("devices/", payload);
};

export const updateDevice = (id, payload) => {
  return api.patch(`devices/${id}/`, payload);
};

export const deleteDevice = (id) => {
  return api.delete(`devices/${id}/`);
};

export const regenerateDeviceApiKey = (id) => {
  // POST to the action endpoint
  return api.post(`devices/${id}/regenerate_api_key/`);
};

export default {
  listDevices,
  getDevice,
  createDevice,
  updateDevice,
  deleteDevice,
  regenerateDeviceApiKey,
};
