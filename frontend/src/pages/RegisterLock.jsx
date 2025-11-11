// src/pages/RegisterLock.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import QRScanner from "../components/QRScanner";

export default function RegisterLock() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ uuid: "", name: "", location: "" });
  const [noLock, setNoLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const handleClaim = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("locks/claim/", form);
      navigate("/locks");
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally { setBusy(false); }
  };

  const handleSkip = () => navigate("/locks");

  const handleScan = (decoded) => {
    // decoded expected to contain uuid (maybe JSON or plain string)
    // Common case: QR contains plain uuid string
    setForm(prev => ({ ...prev, uuid: decoded }));
    setScanning(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Registrar tu cerradura</h2>
          <div>
            <button onClick={() => setScanning(s => !s)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
              {scanning ? "Detener cámara" : "Escanear QR"}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 my-3">Escanea el QR o pega el UUID manualmente.</p>

        {scanning && <QRScanner onScan={(code)=>console.log(code)} />}

        <form onSubmit={handleClaim} className="space-y-3">
          <input value={form.uuid} onChange={(e)=>setForm({...form, uuid:e.target.value})}
                 placeholder="UUID de la cerradura" className="w-full p-2 border rounded" />
          <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}
                 placeholder="Nombre (ej. Puerta Principal)" className="w-full p-2 border rounded" />
          <input value={form.location} onChange={(e)=>setForm({...form, location:e.target.value})}
                 placeholder="Ubicación (ej. Oficina Bogotá)" className="w-full p-2 border rounded" />
          {error && <div className="text-red-600">{JSON.stringify(error)}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded">
              {busy ? "Registrando..." : "Registrar cerradura"}
            </button>
            <button type="button" onClick={() => setForm({ uuid: "", name: "", location: "" })} className="px-4 py-2 bg-gray-200 rounded">
              Limpiar
            </button>
          </div>
        </form>

        <div className="mt-4 border-t pt-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={noLock} onChange={() => setNoLock(!noLock)} />
            <span className="text-sm">No tengo una cerradura (me agregará otro usuario propietario)</span>
          </label>
          {noLock && (
            <div className="mt-3">
              <p className="text-sm text-gray-700">Si no tienes cerradura, serás añadido por el propietario más adelante.</p>
              <button onClick={handleSkip} className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded">Ir al panel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
