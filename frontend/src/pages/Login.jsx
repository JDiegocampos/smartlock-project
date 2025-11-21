// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { useAuth } from "../hooks/useAuth"; // asegúrate que useAuth devuelve { login, verify2fa }

export default function Login() {
  const { login, verify2fa } = useAuth();
  const navigate = useNavigate();

  // Form estado
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // 2FA estado
  const [challenge, setChallenge] = useState(null);
  const [twoCode, setTwoCode] = useState("");
  const [mustSetup, setMustSetup] = useState(false);
  const [otpauth, setOtpauth] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  // UI estado
  const [loading, setLoading] = useState(false); // para submit login
  const [verifying, setVerifying] = useState(false); // para verify2fa
  const [error, setError] = useState(null);

  // Generar DataURL del QR cuando otpauth cambie
  useEffect(() => {
    let mounted = true;
    setQrDataUrl(null);
    if (!otpauth) return;
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
        if (mounted) setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("QR generation error:", err);
        if (mounted) setQrDataUrl(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [otpauth]);

  // Helper para mostrar mensajes de error de forma limpia
  const extractError = (err) => {
    if (!err) return "Error desconocido";
    const resp = err?.response;
    if (!resp) return err.message || String(err);
    const data = resp.data;
    if (data && typeof data === "object") {
      if (data.detail) return data.detail;
      try { return JSON.stringify(data); } catch { return String(data); }
    }
    if (typeof data === "string") {
      const m = data.match(/<title>(.*?)<\/title>/i);
      if (m) return `Error del servidor: ${m[1]}`;
      return data.slice(0, 300).replace(/<[^>]*>/g, "");
    }
    return resp.statusText || `HTTP ${resp.status}`;
  };

  // Paso 1: enviar credenciales -> recibir challenge (siempre, según flujo 2FA forzado)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      // caso challenge devuelto
      if (res?.twoFactorRequired) {
        setChallenge(res.challenge);
        setMustSetup(!!res.must_setup);
        setOtpauth(res.otpauth_url || null);
        setTwoCode("");
        setLoading(false);
        return;
      }
      // si backend devolvió tokens inesperadamente o login directo
      if (res?.success) {
        // ya autenticado en contexto
        navigate("/dashboard");
        return;
      }
      // si hubo error
      setError(res?.error?.detail || res?.error || "Respuesta inesperada del servidor.");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: verificar challenge + código TOTP -> obtener tokens y entrar
  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    if (!challenge) {
      setError("No se generó challenge. Vuelve a intentar iniciar sesión.");
      return;
    }
    if (!twoCode || twoCode.trim().length < 4) {
      setError("Ingresa el código TOTP de 6 dígitos.");
      return;
    }

    setVerifying(true);
    try {
      const res = await verify2fa(challenge, twoCode.trim());
      if (res?.success) {
        navigate("/dashboard");
        return;
      }
      setError(res?.error?.detail || res?.error || "Código inválido o error en verificación.");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setVerifying(false);
    }
  };

  // Opción para reiniciar el flujo (volver a inicio de sesión)
  const resetFlow = () => {
    setChallenge(null);
    setTwoCode("");
    setMustSetup(false);
    setOtpauth(null);
    setQrDataUrl(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded shadow p-6">
        {!challenge && (
          <form onSubmit={handleSubmit} aria-label="login-form">
            <h2 className="text-xl font-semibold mb-4">Iniciar sesión</h2>

            <label className="block text-sm mb-1">Usuario</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded mb-3"
              placeholder="Usuario"
              required
            />

            <label className="block text-sm mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded mb-4"
              placeholder="Contraseña"
              required
            />

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
              disabled={loading}
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>

            {error && <div className="mt-3 text-red-600 text-sm">{String(error)}</div>}
          </form>
        )}

        {challenge && (
          <div aria-label="2fa-form">
            <h2 className="text-lg font-semibold mb-2">Código de autenticación requerido</h2>

            {mustSetup ? (
              <p className="text-sm text-gray-600 mb-3">
                No tienes 2FA configurado. Escanea el QR con tu app autenticadora (Google Authenticator, Authy)
                y luego introduce el código de 6 dígitos.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-3">
                Ingresa el código de 6 dígitos generado por tu app autenticadora.
              </p>
            )}

            <div className="mb-4">
              {otpauth ? (
                <div className="flex gap-4 items-start">
                  <div className="shrink-0">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR para configurar 2FA" width="200" height="200" className="border rounded" />
                    ) : (
                      <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 text-xs text-gray-500 rounded">
                        Generando QR...
                      </div>
                    )}
                  </div>

                  <div className="text-xs break-words text-gray-700">
                    <strong>Si no puedes escanear, copia este URL:</strong>
                    <div className="mt-2 text-sm text-gray-600">{otpauth}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No hay URL de setup disponible.</div>
              )}
            </div>

            <form onSubmit={handleVerify}>
              <input
                value={twoCode}
                onChange={(e) => setTwoCode(e.target.value)}
                placeholder="Código TOTP (6 dígitos)"
                className="w-full p-2 border rounded mb-3"
                inputMode="numeric"
                pattern="\d{6}"
                required
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2 rounded"
                  disabled={verifying}
                >
                  {verifying ? "Verificando..." : "Verificar y continuar"}
                </button>

                <button
                  type="button"
                  onClick={resetFlow}
                  className="px-3 py-2 border rounded text-sm"
                >
                  Volver
                </button>
              </div>
            </form>

            {error && <div className="mt-3 text-red-600 text-sm">{String(error)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
