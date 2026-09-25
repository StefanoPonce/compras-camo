"use client";

import { useEffect } from "react";

const INTERVALO_LATIDO_MS = 20 * 1000;
const PESTANA_STALE_MS = 75 * 1000;
const CLAVE_PESTANAS = "compras-camo:pestanas-activas";

type PestanasActivas = Record<string, number>;

function leerPestanas(): PestanasActivas {
  try {
    const valor = localStorage.getItem(CLAVE_PESTANAS);
    if (!valor) return {};
    const datos = JSON.parse(valor) as PestanasActivas;
    return datos && typeof datos === "object" ? datos : {};
  } catch {
    return {};
  }
}

function guardarPestanas(pestanas: PestanasActivas) {
  try {
    localStorage.setItem(CLAVE_PESTANAS, JSON.stringify(pestanas));
  } catch {
    // Si el navegador bloquea el almacenamiento, el latido del servidor sigue
    // garantizando que la sesión expire cuando el proceso desaparece.
  }
}

export default function ControlSesion() {
  useEffect(() => {
    const idPestana =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    let cierreEnviado = false;
    let latidoEnCurso = false;

    function marcarPestanaActiva() {
      const ahora = Date.now();
      const pestanas = leerPestanas();

      for (const [id, ultimaActividad] of Object.entries(pestanas)) {
        if (ahora - ultimaActividad > PESTANA_STALE_MS) delete pestanas[id];
      }

      pestanas[idPestana] = ahora;
      guardarPestanas(pestanas);
    }

    async function enviarLatido() {
      if (latidoEnCurso) return;
      latidoEnCurso = true;

      try {
        const respuesta = await fetch("/api/sesion", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "latido" }),
        });

        if (respuesta.status === 401) {
          window.location.replace("/login");
        }
      } catch {
        // Un corte de red no demuestra que el usuario cerró sesión. La
        // vigencia corta del servidor se encarga de resolver ese caso.
      } finally {
        latidoEnCurso = false;
      }
    }

    function cerrarSiEsLaUltimaPestana() {
      if (cierreEnviado) return;

      const pestanas = leerPestanas();
      delete pestanas[idPestana];
      guardarPestanas(pestanas);

      const hayOtraPestana = Object.entries(pestanas).some(
        ([id, ultimaActividad]) =>
          id !== idPestana && Date.now() - ultimaActividad <= PESTANA_STALE_MS,
      );
      if (hayOtraPestana) return;

      cierreEnviado = true;
      const cuerpo = JSON.stringify({ accion: "cerrar" });

      // `keepalive` permite completar la petición durante `pagehide` y borrar
      // además la cookie. `sendBeacon` es el respaldo para liberar el bloqueo
      // en el servidor si el navegador corta la respuesta.
      void fetch("/api/sesion", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
        keepalive: true,
      }).catch(() => undefined);

      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/sesion",
          new Blob([cuerpo], { type: "application/json" }),
        );
      }
    }

    marcarPestanaActiva();
    void enviarLatido();

    const intervalo = window.setInterval(() => {
      marcarPestanaActiva();
      void enviarLatido();
    }, INTERVALO_LATIDO_MS);

    const alVolverAVisible = () => {
      if (document.visibilityState === "visible") {
        marcarPestanaActiva();
        void enviarLatido();
      }
    };

    window.addEventListener("pagehide", cerrarSiEsLaUltimaPestana);
    document.addEventListener("visibilitychange", alVolverAVisible);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("pagehide", cerrarSiEsLaUltimaPestana);
      document.removeEventListener("visibilitychange", alVolverAVisible);

      const pestanas = leerPestanas();
      delete pestanas[idPestana];
      guardarPestanas(pestanas);
    };
  }, []);

  return null;
}
