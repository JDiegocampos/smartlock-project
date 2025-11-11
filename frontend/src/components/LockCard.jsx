// src/components/LockCard.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function LockCard({ lock }) {
  return (
    <div className="bg-white p-4 rounded shadow-sm border">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{lock.name || `Cerradura ${lock.id}`}</h3>
          <p className="text-sm text-gray-600">UUID: {lock.uuid}</p>
          <p className="text-sm text-gray-600">Propietario: {lock.owner?.username}</p>
        </div>
        <div className="text-right">
          <span className={`px-2 py-1 rounded text-sm ${lock.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {lock.is_active ? "Activo" : "Inactivo"}
          </span>
          <div className="mt-2">
            <Link to={`/locks/${lock.uuid}`} className="px-3 py-1 bg-blue-600 text-white text-sm rounded mr-2">Ver</Link>
            <button className="px-3 py-1 bg-gray-200 text-sm rounded">Editar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
