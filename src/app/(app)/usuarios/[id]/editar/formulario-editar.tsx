"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { editarUsuario } from "../../../actions";
import {
  MODULOS_POR_ROL,
  ROLES,
  normalizarModulos,
  type Modulo,
  type Rol,
} from "@/lib/permisos";
import PanelModulos from "../../panel-modulos";

type Usuario = {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
  modulosPermitidos: string[];
};

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

export default function FormularioEditarUsuario({ u }: { u: Usuario }) {
  const accion = editarUsuario.bind(null, u.id);
  const [estado, ejecutar] = useFormState(accion, { error: null });
  const [rol, setRol] = useState<Rol>(u.rol);
  const [seleccionados, setSeleccionados] = useState<Modulo[]>(() => normalizarModulos(u.modulosPermitidos, u.rol));

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
    <form action={ejecutar} className="tarjeta p-5 grid gap-3.5">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}
      <input className="campo-input" name="nombre" defaultValue={u.nombre} required />
      <input className="campo-input bg-superficie2" value={u.usuario} disabled />
      <select className="campo-input" name="rol" value={rol} onChange={(evento) => cambiarRol(evento.target.value)}>
        {ROLES.map((r) => (
          <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
        ))}
      </select>
      <input className="campo-input" name="clave" placeholder="Nueva contraseña (opcional)" />
      <PanelModulos rol={rol} seleccionados={seleccionados} onToggle={alternarModulo} />
      <div className="flex gap-2 justify-end">
        <a href="/usuarios" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
