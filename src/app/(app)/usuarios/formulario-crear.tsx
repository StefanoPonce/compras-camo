"use client";
import { useFormState, useFormStatus } from "react-dom";
import { crearUsuario } from "../actions";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn sm:col-span-2 justify-self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar usuario"}</button>;
}

export default function FormularioCrearUsuario() {
  const [estado, accion] = useFormState(crearUsuario, { error: null });

  return (
    <details className="tarjeta p-4 mb-5">
      <summary className="cursor-pointer font-medium text-sm">+ Nuevo usuario</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-3 mt-4">
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}
        <input className="campo-input" name="nombre" placeholder="Nombre completo" required />
        <input className="campo-input" name="usuario" placeholder="Cuenta de acceso" autoCapitalize="none" required />
        <select className="campo-input" name="rol" defaultValue="usuario">
          <option value="usuario">Usuario</option>
          <option value="administrador">Administrador</option>
        </select>
        <input className="campo-input" name="clave" placeholder="Contraseña (mínimo 6 caracteres)" required />
        <BotonGuardar />
      </form>
    </details>
  );
}
