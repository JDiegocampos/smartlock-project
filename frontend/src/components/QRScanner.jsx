// src/components/QRScanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * QRScanner - versión agresiva contra videos huérfanos / duplicados.
 *
 * - Forzosamente detiene/elimna todas las pistas y elementos <video> previos.
 * - Limpia entradas globales window._html5qrcodeInstances.
 * - Añade pequeños delays para darle tiempo al navegador a liberar recursos.
 *
 * Uso:
 *  <QRScanner onScan={(text)=>...} />
 *
 * IMPORTANTE:
 *  - Esto terminará cualquier stream de cámara activo en la página al arrancar.
 *  - Úsalo solo en la vista scanner.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function forceStopAllMediaTracksAndRemoveVideos() {
  try {
    // 1) Stop tracks referenced from video elements
    const videos = Array.from(document.querySelectorAll("video"));
    console.log("[QRScanner] forceStop: found videos:", videos.length);
    for (const v of videos) {
      try {
        const s = v.srcObject;
        if (s && s.getTracks) {
          const tracks = s.getTracks();
          tracks.forEach((t) => {
            try { t.stop(); } catch (e) { console.warn("track.stop failed", e); }
          });
        }
      } catch (err) {
        console.warn("[QRScanner] error stopping tracks for video", err);
      }
    }

    // 2) Stop tracks from navigator.mediaDevices (if any stream references remain)
    if (navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // enumerate devices to check streams - but we cannot stop streams directly here
        // Instead, attempt to get existing streams used by pages via video elements above.
      } catch (e) {
        console.warn("[QRScanner] enumerateDevices error", e);
      }
    }

    // 3) Remove video elements from DOM (aggressive)
    for (const v of videos) {
      try {
        if (v.parentNode) v.parentNode.removeChild(v);
      } catch (e) {
        console.warn("[QRScanner] removeChild failed", e);
      }
    }

    // 4) Remove any nodes added by html5-qrcode library (containers)
    const qNodes = Array.from(document.querySelectorAll(".html5-qrcode, .qr-container, [id^='html5-qrcode']"));
    for (const n of qNodes) {
      try { n.parentNode && n.parentNode.removeChild(n); } catch (e) {}
    }

    // 5) as extra, try to stop tracks referenced at window level (if any user code stored streams)
    try {
      // look for known global fields (best-effort)
      const globals = Object.keys(window);
      for (const g of ["stream", "_stream", "localStream"]) {
        if (window[g] && window[g].getTracks) {
          try {
            window[g].getTracks().forEach(t => { try { t.stop(); } catch(_){} });
            window[g] = null;
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn("[QRScanner] stop global streams error", e);
    }

    // small wait to allow browser to release camera
    await sleep(300);
  } catch (e) {
    console.warn("[QRScanner] forceStopAllMediaTracksAndRemoveVideos error", e);
  }
}

export default function QRScanner({ onScan, elementId = "qr-reader", start = true }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  if (typeof window !== "undefined" && !window._html5qrcodeInstances) {
    window._html5qrcodeInstances = {};
  }

  useEffect(() => {
    let mounted = true;
    let localInstance = null;

    const safeClearGlobalInstances = async () => {
      try {
        const map = window._html5qrcodeInstances || {};
        const keys = Object.keys(map);
        if (keys.length === 0) return;
        console.log("[QRScanner] clearing global instances:", keys);
        for (const k of keys) {
          try {
            const entry = map[k];
            if (entry && entry.instance) {
              try {
                if (entry.running) {
                  await entry.instance.stop();
                }
              } catch (e) { console.warn("[QRScanner] stop existing instance error", e); }
              try { entry.instance.clear(); } catch (e) { /* ignore */ }
            }
          } catch (e) {
            console.warn("[QRScanner] error clearing instance", e);
          } finally {
            try { delete window._html5qrcodeInstances[k]; } catch (e) {}
          }
        }
        // wait a bit for OS/browser to release device
        await sleep(200);
      } catch (e) {
        console.warn("[QRScanner] safeClearGlobalInstances error", e);
      }
    };

    const startScanner = async () => {
      setError(null);
      if (!mounted) return;

      // aggressive cleanup: stop all tracked streams and remove video nodes
      await forceStopAllMediaTracksAndRemoveVideos();

      // ensure any previous instances are stopped & deleted
      await safeClearGlobalInstances();

      const container = containerRef.current ?? document.getElementById(elementId);
      if (!container) {
        setError("Contenedor de QR no encontrado.");
        return;
      }

      // ensure container is empty
      while (container.firstChild) container.removeChild(container.firstChild);

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          setError("No se detectaron cámaras en el dispositivo.");
          return;
        }
        const cameraId = cameras[0].id;
        const instance = new Html5Qrcode(elementId);

        // register global
        window._html5qrcodeInstances[elementId] = { instance, running: false };

        // Start scanner
        await instance.start(
          cameraId,
          { fps: 10, qrbox: 250 },
          (decoded) => {
            if (onScan) onScan(decoded);
          },
          (err) => {
            // ignore decode errors
          }
        );

        window._html5qrcodeInstances[elementId].running = true;
        localInstance = instance;
        console.log("[QRScanner] started new instance:", elementId);
      } catch (e) {
        console.error("[QRScanner] startScanner failed:", e);
        setError("Error iniciando cámara: " + (e.message || e));
        // Attempt cleanup
        try {
          const entry = window._html5qrcodeInstances[elementId];
          if (entry && entry.instance) {
            try { await entry.instance.stop(); } catch (_) {}
            try { entry.instance.clear(); } catch (_) {}
            delete window._html5qrcodeInstances[elementId];
          }
        } catch (_) {}
      }
    };

    if (start) {
      startScanner();
    }

    return () => {
      mounted = false;
      (async () => {
        try {
          // stop and clear the instance for this elementId
          const entry = window._html5qrcodeInstances[elementId];
          if (entry && entry.instance) {
            try {
              if (entry.running) await entry.instance.stop();
            } catch (e) { console.warn("[QRScanner] stop on unmount failed", e); }
            try { entry.instance.clear(); } catch (e) {}
            try { delete window._html5qrcodeInstances[elementId]; } catch (e) {}
          }
          // final aggressive stop and DOM cleanup
          await forceStopAllMediaTracksAndRemoveVideos();
        } catch (e) {
          console.warn("[QRScanner] unmount cleanup error", e);
        }
      })();
    };
  }, [elementId, onScan, start]);

  return (
    <div>
      <div id={elementId} ref={containerRef} style={{ width: "100%" }} />
      {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
    </div>
  );
}
