"use client";
import { useFormState, useFormStatus } from "react-dom";
import { crearMaterial } from "../actions";

type Proveedor = { id: number; nombre: string };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn sm:col-span-2 justify-self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar material"}</button>;
}

export default function FormularioCrearMaterial({ proveedores }: { proveedores: Proveedor[] }) {
  const [estado, accion] = useFormState(crearMaterial, { error: null });

  return (
    <details className="tarjeta p-4 mb-5">
      <summary className="cursor-pointer font-medium text-sm">+ Nuevo material</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-3 mt-4">
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}
        <input className="campo-input" name="codigo" placeholder="Código (MED-004)" required />
        <input className="campo-input" name="categoria" placeholder="Categoría" required />
        <input className="campo-input sm:col-span-2" name="nombre" placeholder="Nombre del material" required />
        <input className="campo-input" name="unidad" placeholder="Unidad (Caja de 100)" required />
        <select className="campo-input" name="proveedorId">
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input className="campo-input" name="existencia" type="number" min={0} placeholder="Existencia actual" />
        <input className="campo-input" name="minimo" type="number" min={0} placeholder="Mínimo en bodega" />
        <input className="campo-input" name="precio" type="number" min={0} step="0.01" placeholder="Precio unitario (L)" />
        <BotonGuardar />
      </form>
    </details>
  );
}
