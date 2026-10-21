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

/** Campo con su nombre arriba. Al editar, los campos ya vienen llenos y el
 *  texto de ayuda (placeholder) no se ve, así que el nombre de cada campo
 *  tiene que estar escrito siempre. */
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
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Campo name="nombre" etiqueta="Nombre completo *">
          <input id="nombre" className="campo-input" name="nombre" defaultValue={u.nombre} required />
        </Campo>
        {/* La cuenta de acceso se puede cambiar: el admin a veces la crea mal
            y, mientras el usuario no haya entrado, es más fácil corregirla
            que dar de baja la cuenta y crear otra. */}
        <Campo name="usuario" etiqueta="Cuenta de acceso *" ayuda="Es el nombre con el que entra al sistema.">
          <input
            id="usuario"
            className="campo-input"
            name="usuario"
            defaultValue={u.usuario}
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
        <Campo name="clave" etiqueta="Nueva contraseña" ayuda="Déjala en blanco si no quieres cambiarla.">
          <input id="clave" className="campo-input" name="clave" placeholder="Nueva contraseña (opcional)" />
        </Campo>
      </div>
      <PanelModulos rol={rol} seleccionados={seleccionados} onToggle={alternarModulo} />
      <div className="flex gap-2 justify-end">
        <a href="/usuarios" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
