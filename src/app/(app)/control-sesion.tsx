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

    function soltarLaPagina() {
      if (cierreEnviado) return;

      const pestanas = leerPestanas();
      delete pestanas[idPestana];
      guardarPestanas(pestanas);

      // Si hay otra pestaña viva de este mismo sistema, esa sigue renovando
      // la sesión, así que aquí no hay que hacer nada.
      const hayOtraPestana = Object.entries(pestanas).some(
        ([id, ultimaActividad]) =>
          id !== idPestana && Date.now() - ultimaActividad <= PESTANA_STALE_MS,
      );
      if (hayOtraPestana) return;

      cierreEnviado = true;

      // Esto NO cierra la sesión: solo le avisa al servidor que acorte el
      // vencimiento y espere. Si en realidad fue una recarga, la página que
      // viene a cargar renueva la sesión con su primer latido. Si el
      // navegador se cerró de verdad, al vencer ese margen la cuenta queda
      // libre. `keepalive` deja que la petición se complete durante `pagehide`.
      void fetch("/api/sesion", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "cerrar" }),
        keepalive: true,
      }).catch(() => undefined);
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

    window.addEventListener("pagehide", soltarLaPagina);
    document.addEventListener("visibilitychange", alVolverAVisible);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("pagehide", soltarLaPagina);
      document.removeEventListener("visibilitychange", alVolverAVisible);

      const pestanas = leerPestanas();
      delete pestanas[idPestana];
      guardarPestanas(pestanas);
    };
  }, []);

  return null;
}
