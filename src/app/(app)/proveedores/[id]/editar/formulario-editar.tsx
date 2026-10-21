"use client";
import { useFormState, useFormStatus } from "react-dom";
import { editarProveedor } from "../../../actions";

type Proveedor = {
  id: number; nombre: string; codigo: string | null; rtn: string | null; contacto: string | null;
  telefono: string | null; correo: string | null; direccion: string | null;
  tipoProducto: string | null; cuentaBancaria: string | null; activo: boolean;
};

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

/** Campo con su nombre arriba. Al editar, los campos ya vienen llenos y el
 *  texto de ayuda (placeholder) no se ve, así que el nombre de cada campo
 *  tiene que estar escrito siempre. */
function Campo({ name, etiqueta, children }: { name: string; etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs text-tinta2 mb-1 font-medium">{etiqueta}</label>
      {children}
    </div>
  );
}

export default function FormularioEditarProveedor({ p }: { p: Proveedor }) {
  const accion = editarProveedor.bind(null, p.id);
  const [estado, ejecutar] = useFormState(accion, { error: null });

  return (
    <form action={ejecutar} className="tarjeta p-5 grid gap-3.5">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}
      <Campo name="nombre" etiqueta="Nombre o razón social *">
        <input id="nombre" className="campo-input" name="nombre" defaultValue={p.nombre} required />
      </Campo>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Campo name="codigo" etiqueta="Código">
          <input id="codigo" className="campo-input" name="codigo" defaultValue={p.codigo || ""} />
        </Campo>
        <Campo name="tipoProducto" etiqueta="Tipo de producto">
          <input id="tipoProducto" className="campo-input" name="tipoProducto" defaultValue={p.tipoProducto || ""} />
        </Campo>
        <Campo name="rtn" etiqueta="RTN">
          <input id="rtn" className="campo-input" name="rtn" defaultValue={p.rtn || ""} />
        </Campo>
        <Campo name="cuentaBancaria" etiqueta="Número de cuenta bancaria">
          <input id="cuentaBancaria" className="campo-input" name="cuentaBancaria" defaultValue={p.cuentaBancaria || ""} />
        </Campo>
        <Campo name="telefono" etiqueta="Teléfono">
          <input id="telefono" className="campo-input" name="telefono" defaultValue={p.telefono || ""} />
        </Campo>
        <Campo name="contacto" etiqueta="Persona de contacto">
          <input id="contacto" className="campo-input" name="contacto" defaultValue={p.contacto || ""} />
        </Campo>
        <Campo name="correo" etiqueta="Correo">
          <input id="correo" className="campo-input" name="correo" type="email" defaultValue={p.correo || ""} />
        </Campo>
        <Campo name="activo" etiqueta="Estado del proveedor">
          <select id="activo" className="campo-input" name="activo" defaultValue={p.activo ? "1" : "0"}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
        </Campo>
      </div>
      <Campo name="direccion" etiqueta="Dirección">
        <input id="direccion" className="campo-input" name="direccion" defaultValue={p.direccion || ""} />
      </Campo>
      <p className="text-xs text-tinta2 -mt-1.5">
        Un proveedor inactivo no aparece al crear requisiciones, pero se sigue viendo en su ficha.
      </p>
      <div className="flex gap-2 justify-end">
        <a href="/proveedores" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
