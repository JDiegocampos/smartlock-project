// src/pages/LockDevices.jsx
import React, { useEffect, useState } from "react";
import { listDevices, regenerateDeviceApiKey, createDevice, deleteDevice } from "../api/devices";

export default function LockDevices({ lock }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ device_type: "MOBILE", uid: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const safeListDevices = async (params) => {
    try { return await listDevices(params); } catch (e1) {}
    try { return await listDevices({ params }); } catch (e2) { throw e2; }
  };

  const fetchDevices = async () => {
    if (!lock?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await safeListDevices({ lock: lock.id });
      setDevices(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error("fetchDevices error", e);
      setDevices([]);
      setError("Error cargando dispositivos.");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (lock?.id) fetchDevices(); else setDevices([]); }, [lock]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createDevice({ lock: lock.id, ...form });
      setForm({ device_type: "MOBILE", uid: "", name: "" });
      await fetchDevices();
    } catch (err) {
      console.error("createDevice error", err);
      setError(err.response?.data || err.message || "Error creando dispositivo.");
    } finally { setBusy(false); }
  };

  const handleRegenerate = async (id) => {
    try {
      const res = await regenerateDeviceApiKey(id);
      alert("Nueva API Key: " + (res.data?.api_key || "—"));
      await fetchDevices();
    } catch (e) {
      console.error("regenerate error", e);
      setError("Error regenerando API Key.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Eliminar dispositivo?")) return;
    try {
      await deleteDevice(id);
      await fetchDevices();
    } catch (e) {
      console.error("deleteDevice error", e);
      setError("Error eliminando dispositivo.");
    }
  };

  useEffect(() => {
    console.log("LockDevices mounted; lock:", lock, "devices:", devices);
  }, [lock, devices]);

  return (
    <div>
      <div className="mb-4">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-2">
          <div className="flex gap-2">
            <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Nombre" className="p-2 border rounded flex-1" />
            <input value={form.uid} onChange={(e)=>setForm({...form, uid:e.target.value})} placeholder="UID" className="p-2 border rounded" />
            <button type="submit" disabled={busy} className="px-3 py-1 bg-green-600 text-white rounded">{busy ? "..." : "Crear"}</button>
          </div>
          {error && <div className="text-red-600 mt-2">{String(error)}</div>}
        </form>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Dispositivos</h4>
        {loading && <p className="text-sm text-gray-600">Cargando...</p>}
        {!loading && devices.length === 0 && <p className="text-sm text-gray-600">No hay dispositivos.</p>}
        {devices.map(d => (
          <div key={d.id} className="p-2 bg-white rounded border flex justify-between items-center mb-2">
            <div>
              <div className="font-medium">{d.name || d.uid}</div>
              <div className="text-xs text-gray-600">Tipo: {d.device_type}</div>
              <div className="text-xs text-gray-600">API Key: {d.api_key ? "••••••" : "—"}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleRegenerate(d.id)} className="px-2 py-1 bg-yellow-500 text-white rounded text-sm">Regenerar API Key</button>
              <button onClick={() => handleDelete(d.id)} className="px-2 py-1 bg-red-500 text-white rounded text-sm">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
