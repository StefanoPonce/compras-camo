"use client";
import { useFormState, useFormStatus } from "react-dom";
import { crearProveedor } from "../actions";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn sm:col-span-2 justify-self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar proveedor"}</button>;
}

export default function FormularioCrearProveedor() {
  const [estado, accion] = useFormState(crearProveedor, { error: null });

  return (
    <details className="tarjeta p-4 mb-5">
      <summary className="cursor-pointer font-medium text-sm">+ Nuevo proveedor</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-3 mt-4">
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}
        <input className="campo-input sm:col-span-2" name="nombre" placeholder="Nombre o razón social" required />
        <input className="campo-input" name="codigo" placeholder="Código (se genera si lo dejas vacío)" />
        <input className="campo-input" name="tipoProducto" placeholder="Tipo de producto (Papelería, Dental…)" />
        <input className="campo-input" name="rtn" placeholder="RTN" />
        <input className="campo-input" name="telefono" placeholder="Teléfono" />
        <input className="campo-input" name="contacto" placeholder="Persona de contacto" />
        <input className="campo-input" name="correo" type="email" placeholder="Correo" />
        <input className="campo-input sm:col-span-2" name="direccion" placeholder="Dirección" />
        <BotonGuardar />
      </form>
    </details>
  );
}
