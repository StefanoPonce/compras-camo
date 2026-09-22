"use client";
import { useFormState, useFormStatus } from "react-dom";
import { editarMaterial } from "../../../actions";

type Material = {
  id: number; codigo: string; nombre: string; categoria: string; unidad: string;
  existencia: number; minimo: number; precioUltimo: number; proveedorId: number | null;
};
type Proveedor = { id: number; nombre: string };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

export default function FormularioEditarMaterial({ m, proveedores }: { m: Material; proveedores: Proveedor[] }) {
  const accion = editarMaterial.bind(null, m.id);
  const [estado, ejecutar] = useFormState(accion, { error: null });

  return (
    <form action={ejecutar} className="tarjeta p-5 grid gap-3.5">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input className="campo-input" name="codigo" defaultValue={m.codigo} required />
        <input className="campo-input" name="categoria" defaultValue={m.categoria} required />
      </div>
      <input className="campo-input" name="nombre" defaultValue={m.nombre} required />
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input className="campo-input" name="unidad" defaultValue={m.unidad} required />
        <select className="campo-input" name="proveedorId" defaultValue={m.proveedorId ?? ""}>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input className="campo-input" name="existencia" type="number" min={0} defaultValue={m.existencia} />
        <input className="campo-input" name="minimo" type="number" min={0} defaultValue={m.minimo} />
      </div>
      <input className="campo-input" name="precio" type="number" min={0} step="0.01" defaultValue={m.precioUltimo} />
      <div className="flex gap-2 justify-end">
        <a href="/materiales" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
