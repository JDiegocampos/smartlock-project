// src/api/pins.js
import api from "./axiosClient";

/**
 * Pins API helpers
 *
 * listPins(params)       -> GET /api/pins/?...   (params es un objeto { lock: id, search: '...', etc. })
 * getPin(id)             -> GET /api/pins/{id}/
 * createPin(payload)     -> POST /api/pins/
 * updatePin(id, payload) -> PATCH /api/pins/{id}/
 * deletePin(id)          -> DELETE /api/pins/{id}/
 */

export const listPins = (params = {}) => {
  // params -> { lock: 1, ... } será enviado como query string
  return api.get("pins/", { params });
};

export const getPin = (id) => {
  return api.get(`pins/${id}/`);
};

export const createPin = (payload) => {
  // payload: { lock, code, is_temporary, start_time, end_time, is_active }
  return api.post("pins/", payload);
};

export const updatePin = (id, payload) => {
  // partial updates OK
  return api.patch(`pins/${id}/`, payload);
};

export const deletePin = (id) => {
  return api.delete(`pins/${id}/`);
};

export default {
  listPins,
  getPin,
  createPin,
  updatePin,
  deletePin,
};
