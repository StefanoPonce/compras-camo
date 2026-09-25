"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { MENSAJES_AUTENTICACION } from "@/lib/auth-errors";
import estilos from "./login.module.css";

type PropiedadesIcono = {
  className?: string;
};

function IconoUsuario({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19c.45-3.3 2.55-5 6.5-5s6.05 1.7 6.5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoCandado({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.25 10V7.75a3.75 3.75 0 0 1 7.5 0V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconoOjo({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.8 12s3.25-5 9.2-5 9.2 5 9.2 5-3.25 5-9.2 5-9.2-5-9.2-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconoOjoCerrado({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M9.25 7.4A10.8 10.8 0 0 1 12 7c5.95 0 9.2 5 9.2 5a15.2 15.2 0 0 1-2.35 2.8M14.8 16.1A10.5 10.5 0 0 1 12 17c-5.95 0-9.2-5-9.2-5a15.6 15.6 0 0 1 3.3-3.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.9 10.05a2.3 2.3 0 0 0 3.25 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconoEscudo({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.2 19 6v5.25c0 4.3-2.75 7.65-7 9.55-4.25-1.9-7-5.25-7-9.55V6l7-2.8Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path d="m8.7 12 2.1 2.1 4.6-4.7" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoDocumento({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3.5h8l4 4V20.5H6v-17Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path d="M14 3.5v4h4M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoProveedores({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.65" />
      <path d="M3.5 19c.3-3.4 2.15-5.1 5.5-5.1s5.2 1.7 5.5 5.1M15.5 5.5a3 3 0 0 1 0 5.8M16 14c2.8.2 4.3 1.9 4.5 5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

function IconoInventario({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 8 8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path d="M4 8v8l8 4 8-4V8M12 12v8M8 6l8 4" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
    </svg>
  );
}

function IconoFlecha({ className }: PropiedadesIcono) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PaginaIngreso() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const router = useRouter();

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError("");

    try {
      const respuesta = await signIn("credentials", {
        usuario,
        clave,
        redirect: false,
      });

      if (respuesta?.error) {
        setError(
          MENSAJES_AUTENTICACION[respuesta.error] ||
            "Usuario o contraseña incorrectos. Verifica y vuelve a intentar.",
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("No fue posible conectar con el sistema. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={estilos.pagina}>
      <main className={estilos.ladoFormulario}>
        <div className={estilos.contenidoFormulario}>
          <header className={estilos.marca}>
            <div className={estilos.logoMarca}>
              <Image
                src="/logo-camo.png"
                alt="Logo de la Fundación CAMO"
                width={70}
                height={70}
                priority
              />
            </div>
            <div>
              <p className={estilos.nombreMarca}>CAMO Honduras</p>
              <p className={estilos.descripcionMarca}>Sistema de proceso de compras</p>
            </div>
          </header>

          <section className={estilos.bloqueAcceso} aria-labelledby="titulo-ingreso">
            <div className={estilos.introduccion}>
              <p className={estilos.sobreTitulo}>Acceso institucional</p>
              <h1 id="titulo-ingreso" className={estilos.titulo}>
                Iniciar sesión
              </h1>
              <p className={estilos.subtitulo}>
                Ingresa con tu usuario  para continuar.
              </p>
            </div>

            <form onSubmit={entrar} className={estilos.formulario}>
              {error && (
                <div className={estilos.error} role="alert" aria-live="polite">
                  <span className={estilos.errorIcono}>!</span>
                  <span>{error}</span>
                </div>
              )}

              <div className={estilos.campo}>
                <label htmlFor="usuario">Usuario </label>
                <div className={estilos.contenedorInput}>
                  <IconoUsuario className={estilos.iconoInput} />
                  <input
                    id="usuario"
                    name="usuario"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Ingresa tu usuario"
                    value={usuario}
                    onChange={(evento) => setUsuario(evento.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={estilos.campo}>
                <label htmlFor="clave">Contraseña</label>
                <div className={estilos.contenedorInput}>
                  <IconoCandado className={estilos.iconoInput} />
                  <input
                    id="clave"
                    name="clave"
                    type={verClave ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Ingresa tu contraseña"
                    value={clave}
                    onChange={(evento) => setClave(evento.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={estilos.botonVerClave}
                    onClick={() => setVerClave((visible) => !visible)}
                    aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={verClave}
                  >
                    {verClave ? (
                      <IconoOjoCerrado className={estilos.iconoOjo} />
                    ) : (
                      <IconoOjo className={estilos.iconoOjo} />
                    )}
                  </button>
                </div>
              </div>

              <div className={estilos.avisoSeguridad}>
                <IconoEscudo className={estilos.iconoEscudo} />
                <span>La sesión se cerrará automáticamente al salir del navegador.</span>
              </div>

              <button type="submit" className={estilos.botonIngresar} disabled={enviando}>
                {enviando ? (
                  <>
                    <span className={estilos.cargador} aria-hidden="true" />
                    Iniciando sesión…
                  </>
                ) : (
                  <>
                    Ingresar
                    <IconoFlecha className={estilos.flechaIngresar} />
                  </>
                )}
              </button>
            </form>

            <div className={estilos.informacionAcceso}>
              <span className={estilos.iconoInformacion}>i</span>
              <p>
                Usa las credenciales asignadas por el administrador del sistema. Si no puedes
                acceder, solicita ayuda al responsable de tu módulo.
              </p>
            </div>
          </section>

          <footer className={estilos.pieFormulario}>
            <p>© 2026 Fundación CAMO</p>
            <span aria-hidden="true">•</span>
            <p>Santa Rosa de Copán, Honduras</p>
          </footer>
        </div>
      </main>

      <aside className={estilos.panelVisual} aria-label="Presentación del sistema de compras">
        <div className={estilos.luzVisual} />
        <Image
          src="/logo-camo.png"
          alt=""
          width={760}
          height={760}
          className={estilos.logoFondo}
          aria-hidden="true"
        />

        <div className={estilos.cabeceraVisual}>
          <span className={estilos.lineaInstitucional} />
          <span>Fundación CAMO Honduras</span>
        </div>

        <div className={estilos.contenidoVisual}>
          <div className={estilos.mensajeVisual}>
            <h2>
              “Con orden, <em>construimos confianza.</em>”
            </h2>
            <p>
              Una plataforma para gestionar requisiciones, proveedores y materiales con
              transparencia y trazabilidad.
            </p>
          </div>

          <div className={estilos.tarjetaProceso} aria-hidden="true">
            <div className={estilos.tarjetaEncabezado}>
              <div>
                <span>Proceso de compras</span>
                <strong>Gestión integral</strong>
              </div>
              <span className={estilos.estadoSeguro}>
                <IconoEscudo /> Seguro
              </span>
            </div>

            <div className={estilos.tarjetaOpciones}>
              <div className={estilos.opcionProceso}>
                <span className={`${estilos.iconoProceso} ${estilos.iconoDocumento}`}>
                  <IconoDocumento />
                </span>
                <div>
                  <strong>Requisiciones</strong>
                  <small>Crear y dar seguimiento a solicitudes</small>
                </div>
                <IconoFlecha className={estilos.flechaProceso} />
              </div>
              <div className={estilos.opcionProceso}>
                <span className={`${estilos.iconoProceso} ${estilos.iconoPersonas}`}>
                  <IconoProveedores />
                </span>
                <div>
                  <strong>Proveedores</strong>
                  <small>Directorio y datos centralizados</small>
                </div>
                <IconoFlecha className={estilos.flechaProceso} />
              </div>
              <div className={estilos.opcionProceso}>
                <span className={`${estilos.iconoProceso} ${estilos.iconoCaja}`}>
                  <IconoInventario />
                </span>
                <div>
                  <strong>Materiales</strong>
                  <small>Control de existencia y movimientos</small>
                </div>
                <IconoFlecha className={estilos.flechaProceso} />
              </div>
            </div>

            <div className={estilos.tarjetaResumen}>
              <div className={estilos.puntosResumen}>
                <span />
                <span />
                <span />
              </div>
              <p>Proceso transparente, seguro y ordenado</p>
              <strong>Fundación CAMO</strong>
            </div>
          </div>
        </div>

        <div className={estilos.pieVisual}>
          <div className={estilos.modulos}>
            <span><IconoDocumento /> Requisiciones</span>
            <span><IconoProveedores /> Proveedores</span>
            <span><IconoInventario /> Materiales</span>
          </div>
          <p className={estilos.nombreSistema}>Sistema de proceso de compras</p>
        </div>
      </aside>
    </div>
  );
}
