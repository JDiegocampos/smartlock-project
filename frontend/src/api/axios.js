// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "https://40llgzg0-8000.use2.devtunnels.ms/api/",
  headers: { "Content-Type": "application/json" },
});

export default api;
