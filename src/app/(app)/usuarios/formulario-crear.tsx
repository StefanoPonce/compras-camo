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
        <input className="campo-input" name="nombre" placeholder="Nombre completo" required />
        <input className="campo-input" name="usuario" placeholder="Cuenta de acceso" autoCapitalize="none" required />
        <select className="campo-input" name="rol" value={rol} onChange={(evento) => cambiarRol(evento.target.value)}>
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
          ))}
        </select>
        <input className="campo-input" name="clave" placeholder="Contraseña (mínimo 6 caracteres)" required />
        <PanelModulos rol={rol} seleccionados={seleccionados} onToggle={alternarModulo} />
        <BotonGuardar />
      </form>
    </details>
  );
}
