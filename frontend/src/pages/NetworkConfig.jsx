// src/pages/NetworkConfig.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  getLockNetworkConfig,
  createLockNetworkConfig,
  updateLockNetworkConfig,
} from "../api/locks";

/**
 * NetworkConfig dinámico:
 * - Descubre dispositivos Bluetooth (user picks device via requestDevice)
 * - Conecta y pide al firmware que haga scan de redes WiFi (firmware debe soportarlo)
 * - Muestra redes detectadas, permite seleccionar una y enviar credenciales
 * - Espera ACK del dispositivo; sólo si hay ACK "ok" guarda en servidor (POST/PATCH)
 *
 * REQUISITOS FIRMWARE (ejemplo de protocolo por JSON):
 * - Service CONTROL_SERVICE_UUID con characteristic CONTROL_CHAR_UUID que soporta:
 *    * write (JSON command) y notifications (JSON responses)
 * - Comandos:
 *    { "action": "scan_wifi" } => device notifica: { "type":"scan_result", "networks":[...] } repetido y al final { "type":"scan_finished" }
 *    { "action": "set_wifi", "ssid":"...", "password":"..." } => device notifica: { "type":"ack", "result":"ok" } o { "type":"ack","result":"error","message":"..." }
 *
 * IMPORTANTE: Web Bluetooth requiere interacción del usuario para requestDevice; cada llamada debe ser iniciada por click.
 */

// ********* AJUSTA ESTOS UUIDs según firmware *********
const CONTROL_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb"; // ejemplo
const CONTROL_CHAR_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";    // ejemplo
// ****************************************************

const TIMEOUT_SCAN_MS = 20000; // tiempo máximo para esperar resultados del scan
const TIMEOUT_ACK_MS = 15000;  // tiempo máximo para esperar ACK del device

function decodeNotificationValue(value) {
  // value: DataView or BufferSource; convert to string
  try {
    // value is DataView
    let text = "";
    if (value instanceof DataView) {
      const arr = new Uint8Array(value.buffer);
      text = new TextDecoder().decode(arr);
    } else if (value.buffer) {
      text = new TextDecoder().decode(new Uint8Array(value.buffer));
    } else {
      // fallback
      text = String(value);
    }
    return text;
  } catch (e) {
    console.warn("decodeNotificationValue error", e);
    return null;
  }
}

// Construcción robusta length-prefixed con conteo en bytes
function buildFramedPayload(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payload); // Uint8Array con bytes UTF-8
  const prefix = String(payloadBytes.length) + ":"; // número decimal ASCII + ':'
  const prefixBytes = enc.encode(prefix); // bytes del prefijo en UTF-8 (ASCII)
  const newline = enc.encode("\n"); // byte para newline (opcional, pero útil)
  // construir Uint8Array total
  const total = new Uint8Array(prefixBytes.length + payloadBytes.length + newline.length);
  total.set(prefixBytes, 0);
  total.set(payloadBytes, prefixBytes.length);
  total.set(newline, prefixBytes.length + payloadBytes.length);
  return total; // Uint8Array listo para enviar
}

export default function NetworkConfig({ lock }) {
  const [config, setConfig] = useState({ ssid: "", password: "", bluetooth_name: "" });
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]); // discovered devices session-wise
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [wifiList, setWifiList] = useState([]); // [{ssid, rssi}]
  const [scanningWifi, setScanningWifi] = useState(false);
  const [btStatus, setBtStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [waitingAck, setWaitingAck] = useState(false);

  // refs to hold bluetooth objects across renders
  const deviceRef = useRef(null);
  const serverRef = useRef(null);
  const characteristicRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const ackTimeoutRef = useRef(null);

  useEffect(() => {
    // Load existing network config from server
    const load = async () => {
      if (!lock?.uuid) return;
      setLoading(true);
      try {
        const res = await getLockNetworkConfig(lock.uuid);
        if (res.data && Object.keys(res.data).length > 0) {
          setConfig({
            ssid: res.data.ssid || "",
            password: res.data.password || "",
            bluetooth_name: res.data.bluetooth_name || "",
          });
        } else {
          setConfig({ ssid: "", password: "", bluetooth_name: "" });
        }
      } catch (e) {
        console.error("Error loading net config", e);
        setError("No se pudo obtener la configuración.");
      } finally {
        setLoading(false);
      }
    };
    load();

    // cleanup on unmount: disconnect
    return () => {
      cleanupBluetooth();
      clearTimeout(scanTimeoutRef.current);
      clearTimeout(ackTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock]);

  const cleanupBluetooth = async () => {
    try {
      if (characteristicRef.current) {
        try {
          await characteristicRef.current.stopNotifications();
        } catch (e) {}
        characteristicRef.current.removeEventListener?.("characteristicvaluechanged", handleNotification);
      }
    } catch (e) {}
    try {
      if (serverRef.current && serverRef.current.connected) {
        try { serverRef.current.disconnect(); } catch (e) {}
      }
    } catch (e) {}
    deviceRef.current = null;
    serverRef.current = null;
    characteristicRef.current = null;
    setConnected(false);
  };

  // Notification handler (parses JSON messages from device)
  function handleNotification(event) {
    try {
      const text = decodeNotificationValue(event.target.value || event.detail?.value);
      if (!text) return;
      // device may send multiple JSON messages or a stream — try to parse
      let obj = null;
      try { obj = JSON.parse(text); } catch (e) {
        // maybe line-delimited; try to extract first JSON substring
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try { obj = JSON.parse(text.slice(start, end + 1)); } catch (err) { obj = null; }
        }
      }
      if (!obj) {
        console.warn("Unknown notification payload:", text);
        return;
      }

      // Handle types
      if (obj.type === "scan_result" && Array.isArray(obj.networks)) {
        // append networks, avoid duplicates by ssid
        setWifiList((prev) => {
          const map = new Map(prev.map(n => [n.ssid, n]));
          for (const net of obj.networks) {
            if (!map.has(net.ssid)) map.set(net.ssid, net);
            else {
              // update if better RSSI
              const existing = map.get(net.ssid);
              if ((net.rssi ?? -999) > (existing.rssi ?? -999)) map.set(net.ssid, net);
            }
          }
          return Array.from(map.values()).sort((a,b) => (b.rssi ?? 0) - (a.rssi ?? 0));
        });
      } else if (obj.type === "scan_finished") {
        setScanningWifi(false);
        setBtStatus("Escaneo completado.");
        clearTimeout(scanTimeoutRef.current);
      } else if (obj.type === "ack") {
        // ack from device for set_wifi
        setWaitingAck(false);
        clearTimeout(ackTimeoutRef.current);
        if (obj.result === "ok") {
          setBtStatus("Cerradura confirmó recepción (ACK OK). Guardando en servidor...");
          // guardar en backend
          saveConfigToServer().catch(e => {
            console.error("Error guardando tras ACK:", e);
            setError("No se pudo guardar en servidor tras confirmación del dispositivo.");
          });
        } else {
          setBtStatus(null);
          setError(obj.message || "Dispositivo respondió con error al establecer la red.");
        }
      } else {
        console.debug("notification unknown type", obj);
      }
    } catch (e) {
      console.error("handleNotification error", e);
    }
  }

  // ******** Bluetooth flows ********

  const discoverBluetoothDevice = async () => {
    setError(null);
    setBtStatus("Buscando dispositivos Bluetooth (selecciona el dispositivo de la cerradura)...");
    try {
      // Request device: allow user to pick device. Use optionalServices so we can access characteristics.
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [CONTROL_SERVICE_UUID],
      });
      // Add to session list
      setDevices((prev) => {
        // avoid duplicates by id
        if (prev.some(d => d.id === device.id)) return prev;
        return [...prev, { id: device.id, name: device.name || device.id, device }];
      });
      setBtStatus(`Dispositivo seleccionado: ${device.name || device.id}`);
      // set as selected
      setSelectedDevice({ id: device.id, name: device.name || device.id, device });
    } catch (e) {
      console.error("requestDevice error", e);
      setError(e.message || "No se seleccionó dispositivo.");
      setBtStatus(null);
    }
  };

  const connectToSelectedDevice = async () => {
    setError(null);
    setBtStatus("Conectando al dispositivo...");
    try {
      if (!selectedDevice?.device) throw new Error("No hay dispositivo seleccionado.");
      const dev = selectedDevice.device;
      deviceRef.current = dev;
      const server = await dev.gatt.connect();
      serverRef.current = server;
      setConnected(true);
      setBtStatus("Conectado. Preparando canal de control...");
      // get service & characteristic
      const service = await server.getPrimaryService(CONTROL_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CONTROL_CHAR_UUID);
      characteristicRef.current = characteristic;

      // subscribe to notifications
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleNotification);
      setBtStatus("Canal listo. Puedes solicitar escaneo de Wi-Fi.");
    } catch (e) {
      console.error("connect error", e);
      setError("No se pudo conectar al dispositivo: " + (e.message || String(e)));
      setBtStatus(null);
      setConnected(false);
      // cleanup partial
      try { if (serverRef.current && serverRef.current.connected) serverRef.current.disconnect(); } catch (_) {}
      serverRef.current = null;
      characteristicRef.current = null;
      deviceRef.current = null;
    }
  };

  const requestWifiScan = async () => {
    setError(null);
    setWifiList([]);
    setScanningWifi(true);
    setBtStatus("Solicitando escaneo de redes Wi-Fi a la cerradura...");
    try {
      if (!characteristicRef.current) throw new Error("Canal no inicializado.");
      // send command JSON
      const framedBytes = buildFramedPayload({ action: "scan_wifi" });
      await characteristicRef.current.writeValueWithResponse?.(framedBytes).catch(() => characteristicRef.current.writeValue(framedBytes));
      // set timeout guard
      scanTimeoutRef.current = setTimeout(() => {
        if (scanningWifi) {
          setScanningWifi(false);
          setBtStatus("Timeout de escaneo. Mostrando resultados parciales (si hay).");
        }
      }, TIMEOUT_SCAN_MS);
    } catch (e) {
      console.error("requestWifiScan error", e);
      setScanningWifi(false);
      setBtStatus(null);
      setError("No se pudo solicitar escaneo a la cerradura: " + (e.message || e));
    }
  };

  const sendWifiCredentialsToDevice = async (ssid, password) => {
    setError(null);
    setWaitingAck(true);
    setBtStatus("Enviando credenciales a la cerradura...");
    try {
      if (!characteristicRef.current) throw new Error("Canal no inicializado.");
      const framedBytes = buildFramedPayload({ action: "set_wifi", ssid, password });
      await characteristicRef.current.writeValueWithResponse?.(framedBytes).catch(() => characteristicRef.current.writeValue(framedBytes));
      // wait for ACK via notifications (handleNotification handles ACK)
      ackTimeoutRef.current = setTimeout(() => {
        if (waitingAck) {
          setWaitingAck(false);
          setBtStatus(null);
          setError("Timeout esperando confirmación del dispositivo.");
        }
      }, TIMEOUT_ACK_MS);
    } catch (e) {
      console.error("sendWifiCredentials error", e);
      setWaitingAck(false);
      setBtStatus(null);
      setError("Error enviando credenciales: " + (e.message || e));
    }
  };

  // save config to server (called only after ACK ok or manual user save)
  const saveConfigToServer = async () => {
    if (!lock?.uuid) throw new Error("Lock uuid missing");
    setSaving(true);
    try {
      const payload = {
        ssid: config.ssid,
        password: config.password,
        bluetooth_name: config.bluetooth_name,
      };
      const current = await getLockNetworkConfig(lock.uuid);
      if (!current.data || Object.keys(current.data).length === 0) {
        await createLockNetworkConfig(lock.uuid, payload);
      } else {
        await updateLockNetworkConfig(lock.uuid, payload);
      }
      setBtStatus("Configuración guardada en servidor.");
    } catch (e) {
      console.error("saveConfigToServer error", e);
      setError("No se pudo guardar la configuración en el servidor.");
    } finally {
      setSaving(false);
    }
  };

  // UI helpers
  const onSelectDeviceFromList = (d) => {
    setSelectedDevice(d);
    setBtStatus(`Seleccionado ${d.name || d.id}`);
  };

  const onChooseNetwork = (ssid) => {
    setConfig((c) => ({ ...c, ssid }));
  };

  return (
    <div className="p-4 bg-white rounded border">
      <h3 className="text-lg font-semibold mb-3">Configurar red de la cerradura</h3>

      {loading ? (
        <p className="text-sm text-gray-600">Cargando...</p>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-xs text-gray-500">UUID</div>
            <div className="text-sm">{lock?.uuid}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm mb-1">Bluetooth: dispositivos cercanos</label>
              <div className="flex gap-2 mb-2">
                <button onClick={discoverBluetoothDevice} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Buscar dispositivos</button>
                <button disabled={!selectedDevice} onClick={connectToSelectedDevice} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Conectar</button>
                <button disabled={!connected} onClick={() => { cleanupBluetooth(); setBtStatus("Desconectado"); }} className="px-3 py-1 bg-gray-200 text-sm rounded">Desconectar</button>
              </div>

              <div className="mb-2">
                {devices.length === 0 && <div className="text-sm text-gray-500">No hay dispositivos seleccionados.</div>}
                {devices.map((d) => (
                  <div key={d.id} className={`p-2 rounded mb-1 cursor-pointer ${selectedDevice?.id === d.id ? "bg-gray-100" : "bg-white"}`} onClick={() => onSelectDeviceFromList(d)}>
                    <div className="font-medium text-sm">{d.name}</div>
                    <div className="text-xs text-gray-500">{d.id}</div>
                  </div>
                ))}
              </div>

              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Estado Bluetooth</div>
                <div className="text-sm">{btStatus || (connected ? "Conectado" : "Desconectado")}</div>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Wi-Fi: redes detectadas por la cerradura</label>
              <div className="flex gap-2 mb-2">
                <button disabled={!connected || scanningWifi} onClick={requestWifiScan} className="px-3 py-1 bg-green-600 text-white rounded text-sm">{scanningWifi ? "Escaneando..." : "Solicitar escaneo Wi-Fi"}</button>
                <button onClick={() => setWifiList([])} className="px-3 py-1 bg-gray-200 rounded text-sm">Limpiar lista</button>
              </div>

              <div className="max-h-48 overflow-auto border rounded p-2">
                {wifiList.length === 0 && <div className="text-sm text-gray-500">No hay redes detectadas.</div>}
                {wifiList.map((n) => (
                  <div key={n.ssid} className="p-2 rounded hover:bg-gray-50 cursor-pointer" onClick={() => onChooseNetwork(n.ssid)}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{n.ssid}</div>
                      <div className="text-xs text-gray-500">RSSI: {n.rssi ?? "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm mb-1">SSID seleccionado</label>
            <input className="p-2 border rounded w-full" value={config.ssid} onChange={(e) => setConfig({ ...config, ssid: e.target.value })} />
            <label className="block text-sm mt-2 mb-1">Contraseña</label>
            <input type="password" className="p-2 border rounded w-full" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} />
            <label className="block text-sm mt-2 mb-1">Nombre Bluetooth (opcional)</label>
            <input className="p-2 border rounded w-full" value={config.bluetooth_name} onChange={(e) => setConfig({ ...config, bluetooth_name: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-2 bg-blue-600 text-white rounded" disabled={!connected || !config.ssid || waitingAck} onClick={() => sendWifiCredentialsToDevice(config.ssid, config.password)}>
              {waitingAck ? "Esperando confirmación..." : "Enviar credenciales a cerradura"}
            </button>

            <button className="px-3 py-2 bg-gray-200 rounded" disabled={saving} onClick={() => saveConfigToServer()}>
              {saving ? "Guardando..." : "Guardar en servidor (sin enviar)"}
            </button>
          </div>

          <div className="mt-3">
            {error && <div className="text-sm text-red-600">{String(error)}</div>}
            {!error && btStatus && <div className="text-sm text-blue-600">{btStatus}</div>}
            {!error && !btStatus && <div className="text-sm text-gray-500">Estado: {connected ? "Conectado al dispositivo" : "No conectado"}</div>}
          </div>
        </>
      )}
    </div>
  );
}
