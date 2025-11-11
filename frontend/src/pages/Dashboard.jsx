// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listLocks } from "../api/locks";
import LockCard from "../components/LockCard";

export default function Dashboard() {
  const { user } = useAuth();
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLocks = async () => {
      setLoading(true);
      try {
        const res = await listLocks();
        // backend devuelve array (según estructura previa)
        setLocks(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLocks();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Hola, {user?.username ?? "usuario"}</h1>
            <p className="text-sm text-gray-600">Rol: {user?.role ?? "—"}</p>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Tus cerraduras</h2>
          {loading && <p className="text-gray-600">Cargando cerraduras...</p>}
          {error && <div className="text-red-600">{JSON.stringify(error)}</div>}

          {!loading && locks.length === 0 && (
            <div className="bg-white p-4 rounded shadow text-gray-600">
              No tienes cerraduras asignadas. Puedes <a href="/register-lock" className="text-blue-600 underline">registrar una cerradura</a> o esperar a que otro usuario te agregue.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {locks.map((lk) => (
              <LockCard key={lk.uuid ?? lk.id} lock={lk} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Actividad reciente</h2>
          <p className="text-sm text-gray-600">Aquí aparecerán notificaciones o resúmenes (pendiente de implementar logs rápidos en el dashboard).</p>
        </section>
      </div>
    </div>
  );
}
