// src/pages/PinsPage.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axiosClient";

export default function PinsPage() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPins = async () => {
      setLoading(true);
      try {
        const res = await api.get("pins/");
        setPins(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPins();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">PINs</h2>
      {loading ? <p>Cargando...</p> :
        <div className="space-y-3">
          {pins.length === 0 && <p className="text-gray-600">No hay PINs.</p>}
          {pins.map(p => (
            <div key={p.id} className="bg-white p-3 rounded shadow-sm border">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">Código: {p.code}</p>
                  <p className="text-sm text-gray-600">Tipo: {p.type}</p>
                  <p className="text-sm text-gray-600">Válido hasta: {p.expires_at || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 bg-gray-200 rounded">Editar</button>
                  <button className="px-3 py-1 bg-red-500 text-white rounded">Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
