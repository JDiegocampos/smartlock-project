// src/pages/LockPins.jsx
import React, { useEffect, useState } from "react";
import { listPins, createPin, deletePin } from "../api/pins";

export default function LockPins({ lock }) {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", is_temporary: false, is_active: true, start_time: "", end_time: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const safeListPins = async (params) => {
    try { return await listPins(params); } catch (e1) {}
    try { return await listPins({ params }); } catch (e2) { throw e2; }
  };

  const fetchPins = async () => {
    if (!lock?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await safeListPins({ lock: lock.id });
      setPins(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error("fetchPins error", e);
      setPins([]);
      setError("Error cargando PINs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (lock?.id) fetchPins(); else setPins([]); }, [lock]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = { lock: lock.id, code: form.code, is_temporary: form.is_temporary, is_active: form.is_active };
      if (form.is_temporary) {
        // form.start_time / end_time provienen de <input type="datetime-local"> -> "YYYY-MM-DDTHH:mm"
        const startISO = new Date(form.start_time).toISOString(); // convierte a UTC ISO con Z
        const endISO = new Date(form.end_time).toISOString();
        payload.start_time = startISO;
        payload.end_time = endISO;
      }
      await createPin(payload);
      setForm({ code: "", is_temporary: false, is_active: true, start_time: "", end_time: "" });
      await fetchPins();
    } catch (err) {
      console.error("createPin error", err);
      setError(err.response?.data || err.message || "Error al crear PIN.");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Eliminar PIN?")) return;
    try {
      await deletePin(id);
      await fetchPins();
    } catch (e) {
      console.error("deletePin error", e);
      setError("Error eliminando PIN.");
    }
  };

  useEffect(() => {
    console.log("LockPins mounted; lock:", lock, "pins:", pins);
  }, [lock, pins]);

  return (
    <div>
      <div className="mb-4">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-2">
          <div className="flex gap-2">
            <input value={form.code} onChange={(e) => setForm({...form, code: e.target.value})}
                   placeholder="Código PIN" className="p-2 border rounded flex-1" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_temporary} onChange={(e)=>setForm({...form, is_temporary: e.target.checked})} />
              <span className="text-sm">Temporal</span>
            </label>
            <button type="submit" disabled={busy} className="px-3 py-1 bg-green-600 text-white rounded">{busy ? "..." : "Crear"}</button>
          </div>

          {form.is_temporary && (
            <div className="flex gap-2">
              <input type="datetime-local" value={form.start_time} onChange={(e)=>setForm({...form, start_time:e.target.value})} className="p-2 border rounded" />
              <input type="datetime-local" value={form.end_time} onChange={(e)=>setForm({...form, end_time:e.target.value})} className="p-2 border rounded" />
            </div>
          )}

          {error && <div className="text-red-600">{JSON.stringify(error)}</div>}
        </form>
      </div>

      <div>
        <h4 className="font-semibold mb-2">PINs</h4>
        {loading && <p className="text-sm text-gray-600">Cargando...</p>}
        {!loading && pins.length === 0 && <p className="text-sm text-gray-600">No hay PINs.</p>}
        {pins.map(p => (
          <div key={p.id} className="p-2 bg-white rounded border flex justify-between items-center mb-2">
            <div>
              <div className="font-medium">{p.code}</div>
              <div className="text-xs text-gray-600">{p.is_temporary ? `Temporal: ${p.start_time} → ${p.end_time}` : "Permanente"}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(p.id)} className="px-2 py-1 bg-red-500 text-white rounded text-sm">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
