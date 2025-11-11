// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login(form.username, form.password);
      if (res?.success === false) {
        setError(res.error || "Error en credenciales");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError("Error al iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow">
        <h1 className="text-center text-xl font-semibold mb-4">Iniciar sesión</h1>
        {error && <div className="text-red-600 mb-2">{JSON.stringify(error)}</div>}
        <input value={form.username} onChange={(e)=>setForm({...form, username:e.target.value})}
               placeholder="Usuario" className="w-full p-2 border rounded mb-3" />
        <input type="password" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})}
               placeholder="Contraseña" className="w-full p-2 border rounded mb-3" />
        <button type="submit" disabled={busy} className="w-full py-2 bg-blue-600 text-white rounded">
          {busy ? "Ingresando..." : "Entrar"}
        </button>

        <p className="mt-4 text-sm text-center">
          ¿No tienes cuenta? <Link to="/register" className="text-blue-600">Regístrate</Link>
        </p>
      </form>
    </div>
  );
}
