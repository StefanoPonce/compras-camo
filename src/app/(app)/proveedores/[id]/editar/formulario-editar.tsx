"use client";
import { useFormState, useFormStatus } from "react-dom";
import { editarProveedor } from "../../../actions";

type Proveedor = {
  id: number; nombre: string; codigo: string | null; rtn: string | null; contacto: string | null;
  telefono: string | null; correo: string | null; direccion: string | null;
  tipoProducto: string | null; activo: boolean;
};

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

export default function FormularioEditarProveedor({ p }: { p: Proveedor }) {
  const accion = editarProveedor.bind(null, p.id);
  const [estado, ejecutar] = useFormState(accion, { error: null });

  return (
    <form action={ejecutar} className="tarjeta p-5 grid gap-3.5">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}
      <input className="campo-input" name="nombre" defaultValue={p.nombre} required />
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input className="campo-input" name="codigo" placeholder="Código" defaultValue={p.codigo || ""} />
        <input className="campo-input" name="tipoProducto" placeholder="Tipo de producto" defaultValue={p.tipoProducto || ""} />
        <input className="campo-input" name="rtn" placeholder="RTN" defaultValue={p.rtn || ""} />
        <input className="campo-input" name="telefono" placeholder="Teléfono" defaultValue={p.telefono || ""} />
        <input className="campo-input" name="contacto" placeholder="Contacto" defaultValue={p.contacto || ""} />
        <input className="campo-input" name="correo" type="email" placeholder="Correo" defaultValue={p.correo || ""} />
      </div>
      <input className="campo-input" name="direccion" placeholder="Dirección" defaultValue={p.direccion || ""} />
      <select className="campo-input" name="activo" defaultValue={p.activo ? "1" : "0"}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <div className="flex gap-2 justify-end">
        <a href="/proveedores" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
