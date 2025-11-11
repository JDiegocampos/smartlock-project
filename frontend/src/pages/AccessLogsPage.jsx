// src/pages/AccessLogsPage.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axiosClient";

export default function AccessLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("accesslogs/");
        setLogs(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Registros de acceso</h2>
      {loading ? <p>Cargando...</p> :
        <div className="space-y-2">
          {logs.length === 0 && <p className="text-gray-600">No hay registros.</p>}
          {logs.map(l => (
            <div key={l.id} className="bg-white p-3 rounded shadow-sm border">
              <p className="font-medium">Cerradura: {l.lock_uuid || l.lock}</p>
              <p className="text-sm text-gray-600">Usuario: {l.user?.username || l.user}</p>
              <p className="text-sm text-gray-600">Resultado: {l.result}</p>
              <p className="text-xs text-gray-500">{l.timestamp}</p>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
