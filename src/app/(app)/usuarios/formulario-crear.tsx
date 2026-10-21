"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearUsuario } from "../actions";
import { MODULOS_POR_ROL, ROLES, type Modulo, type Rol } from "@/lib/permisos";
import PanelModulos from "./panel-modulos";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn sm:col-span-2 justify-self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar usuario"}</button>;
}

/** Campo con su nombre arriba. El texto de ayuda (placeholder) desaparece
 *  apenas se empieza a escribir, así que el nombre del campo va escrito. */
function Campo({
  name,
  etiqueta,
  ayuda,
  children,
}: {
  name: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs text-tinta2 mb-1 font-medium">{etiqueta}</label>
      {children}
      {ayuda && <p className="text-xs text-tinta2 mt-1">{ayuda}</p>}
    </div>
  );
}

export default function FormularioCrearUsuario() {
  const [estado, accion] = useFormState(crearUsuario, { error: null });
  const [rol, setRol] = useState<Rol>("responsable_solicitante");
  const [seleccionados, setSeleccionados] = useState<Modulo[]>([...MODULOS_POR_ROL.responsable_solicitante]);

  function cambiarRol(valor: string) {
    const nuevoRol = valor as Rol;
    setRol(nuevoRol);
    setSeleccionados([...MODULOS_POR_ROL[nuevoRol]]);
  }

  function alternarModulo(modulo: Modulo) {
    if (modulo === "panel") return;
    setSeleccionados((actuales) =>
      actuales.includes(modulo) ? actuales.filter((valor) => valor !== modulo) : [...actuales, modulo]
    );
  }

  return (
    <details className="tarjeta p-4 mb-5">
      <summary className="cursor-pointer font-medium text-sm">+ Nuevo usuario</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-3 mt-4">
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}
        <Campo name="nombre" etiqueta="Nombre completo *">
          <input id="nombre" className="campo-input" name="nombre" placeholder="Nombre completo" required />
        </Campo>
        <Campo name="usuario" etiqueta="Cuenta de acceso *" ayuda="Es el nombre con el que entra al sistema.">
          <input
            id="usuario"
            className="campo-input"
            name="usuario"
            placeholder="Cuenta de acceso"
            autoCapitalize="none"
            autoComplete="off"
            required
          />
        </Campo>
        <Campo name="rol" etiqueta="Rol *">
          <select
            id="rol"
            className="campo-input"
            name="rol"
            value={rol}
            onChange={(evento) => cambiarRol(evento.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
            ))}
          </select>
        </Campo>
        <Campo name="clave" etiqueta="Contraseña *" ayuda="Mínimo 6 caracteres.">
          <input
            id="clave"
            className="campo-input"
            name="clave"
            placeholder="Contraseña (mínimo 6 caracteres)"
            required
          />
        </Campo>
        <PanelModulos rol={rol} seleccionados={seleccionados} onToggle={alternarModulo} />
        <BotonGuardar />
      </form>
    </details>
  );
}
