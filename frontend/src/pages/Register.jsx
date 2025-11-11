// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axiosClient"; // usar axiosClient para llamadas

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("users/register/", form);
      // al registrarse, redirigir a RegisterLock para que agregue su cerradura
      navigate("/register-lock");
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h1 className="text-center text-xl font-semibold mb-4">Crear cuenta</h1>
        {error && <div className="text-red-600 mb-2">{JSON.stringify(error)}</div>}
        <input value={form.username} onChange={e=>setForm({...form, username:e.target.value})}
               placeholder="Usuario" className="w-full p-2 border rounded mb-3" />
        <input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}
               placeholder="Correo" className="w-full p-2 border rounded mb-3" />
        <input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}
               placeholder="Contraseña" className="w-full p-2 border rounded mb-3" />
        <button type="submit" disabled={busy} className="w-full py-2 bg-green-600 text-white rounded">
          {busy ? "Registrando..." : "Registrar"}
        </button>
        <p className="mt-3 text-sm text-center">
          ¿Ya tienes cuenta? <Link to="/login" className="text-blue-600">Ingresar</Link>
        </p>
      </form>
    </div>
  );
}
