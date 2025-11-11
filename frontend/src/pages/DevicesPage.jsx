// src/pages/DevicesPage.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axiosClient";

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("devices/");
        setDevices(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const regenerate = async (id) => {
    try {
      await api.post(`devices/${id}/regenerate_api_key/`);
      // refrescar lista
      const res = await api.get("devices/");
      setDevices(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Dispositivos</h2>
      {loading ? <p>Cargando...</p> :
        <div className="space-y-3">
          {devices.length === 0 && <p className="text-gray-600">No hay dispositivos.</p>}
          {devices.map(d => (
            <div key={d.id} className="bg-white p-3 rounded shadow-sm border flex justify-between">
              <div>
                <p className="font-medium">{d.name || `Device ${d.id}`}</p>
                <p className="text-sm text-gray-600">Tipo: {d.type || "—"}</p>
                <p className="text-sm text-gray-600">API key: {d.api_key ? "******" : "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => regenerate(d.id)} className="px-3 py-1 bg-yellow-500 text-white rounded">Regenerar API Key</button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
