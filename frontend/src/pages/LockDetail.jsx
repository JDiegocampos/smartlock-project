// src/pages/LockDetail.jsx
import React, { useEffect, useState, Suspense, lazy } from "react";
import { useParams, Link } from "react-router-dom";
import { getLock } from "../api/locks";

// lazy-load components (mejora rendimiento y evita crashes globales)
const LockUsers = lazy(() => import("./LockUsers"));
const LockPins = lazy(() => import("./LockPins"));
const LockDevices = lazy(() => import("./LockDevices"));
const NetworkConfig = lazy(() => import("./NetworkConfig"));

// simple ErrorBoundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          <strong>Error al cargar la sección:</strong>
          <div className="mt-2">{String(this.state.error)}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LockDetail() {
  const { uuid } = useParams();
  const [lock, setLock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview/users/pins/devices/network
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getLock(uuid);
        if (!mounted) return;
        setLock(res.data);
      } catch (err) {
        console.error("getLock error:", err);
        const status = err?.response?.status;
        if (status === 403) setError("No tienes permiso para ver esta cerradura.");
        else if (status === 404) setError("Cerradura no encontrada.");
        else setError("Error al cargar la cerradura.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (uuid) fetch();
    return () => { mounted = false; };
  }, [uuid]);

  if (loading) return <div className="p-6">Cargando cerradura...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!lock) return <div className="p-6 text-gray-600">Cerradura no disponible.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{lock.name || `Cerradura ${lock.id}`}</h1>
            <p className="text-sm text-gray-600">UUID: {lock.uuid}</p>
            <p className="text-sm text-gray-600">Ubicación: {lock.location || "—"}</p>
            <p className="text-sm text-gray-600">Propietario: {lock.owner?.username ?? "—"}</p>
          </div>
          <div>
            <Link to="/locks" className="text-sm text-blue-600">Volver a cerraduras</Link>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <nav className="flex gap-3 border-b pb-3 mb-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1 ${activeTab === "overview" ? "border-b-2 border-blue-600" : "text-gray-600"}`}
            >
              Overview
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`px-3 py-1 ${activeTab === "users" ? "border-b-2 border-blue-600" : "text-gray-600"}`}
            >
              Usuarios
            </button>

            <button
              onClick={() => setActiveTab("pins")}
              className={`px-3 py-1 ${activeTab === "pins" ? "border-b-2 border-blue-600" : "text-gray-600"}`}
            >
              PINs
            </button>

            <button
              onClick={() => setActiveTab("devices")}
              className={`px-3 py-1 ${activeTab === "devices" ? "border-b-2 border-blue-600" : "text-gray-600"}`}
            >
              Dispositivos
            </button>

            {/* Nueva pestaña: Network / Bluetooth */}
            <button
              onClick={() => setActiveTab("network")}
              className={`px-3 py-1 ${activeTab === "network" ? "border-b-2 border-blue-600" : "text-gray-600"}`}
            >
              Red / Bluetooth
            </button>
          </nav>

          <div>
            {activeTab === "overview" && (
              <div>
                <h3 className="font-semibold">Resumen</h3>
                <p className="text-sm text-gray-600 mt-2">Estado: {lock.is_active ? "Activo" : "Inactivo"}</p>
                <p className="text-sm text-gray-600">Creado en: {lock.created_at ? new Date(lock.created_at).toLocaleString() : "—"}</p>
              </div>
            )}

            {activeTab === "users" && (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-4">Cargando usuarios...</div>}>
                  <LockUsers lock={lock} />
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "pins" && (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-4">Cargando PINs...</div>}>
                  <LockPins lock={lock} />
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "devices" && (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-4">Cargando dispositivos...</div>}>
                  <LockDevices lock={lock} />
                </Suspense>
              </ErrorBoundary>
            )}

            {activeTab === "network" && (
              <ErrorBoundary>
                <Suspense fallback={<div className="p-4">Cargando configuración de red...</div>}>
                  <NetworkConfig lock={lock} />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
