// src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="font-semibold text-lg">Lock My Lock</Link>
          <nav className="hidden md:flex gap-3 text-sm">
            <Link to="/locks" className="text-gray-600 hover:text-gray-900">Cerraduras</Link>
            <Link to="/pins" className="text-gray-600 hover:text-gray-900">PINs</Link>
            <Link to="/devices" className="text-gray-600 hover:text-gray-900">Dispositivos</Link>
            <Link to="/accesslogs" className="text-gray-600 hover:text-gray-900">Logs</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="text-right mr-2">
                <div className="text-sm text-gray-800 font-medium">{user.username}</div>
                <div className="text-xs text-gray-500">{user.role || ""}</div>
              </div>
              <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded text-sm">Cerrar sesión</button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Ingresar</Link>
          )}
        </div>
      </div>
    </header>
  );
}
