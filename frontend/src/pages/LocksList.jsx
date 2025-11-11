// src/pages/LocksList.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axiosClient"; // llamadas; interceptores vienen de axiosClient import en AuthContext
import LockCard from "../components/LockCard";

export default function LocksList() {
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get("locks/");
        // Tu endpoint devuelve objetos individuales (no lista anidada)
        // Aseguramos que sea array
        const data = Array.isArray(res.data) ? res.data : [res.data];
        setLocks(data);
      } catch (e) {
        setError(e.response?.data || e.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <p>Cargando cerraduras...</p>;
  if (error) return <div className="text-red-600">Error: {JSON.stringify(error)}</div>;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {locks.map((lk) => (
          <LockCard key={lk.uuid || lk.id} lock={lk} />
        ))}
      </div>
      {locks.length === 0 && <p className="mt-4 text-gray-600">No tienes cerraduras asignadas.</p>}
    </div>
  );
}
