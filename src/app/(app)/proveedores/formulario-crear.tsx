"use client";
import { useFormState, useFormStatus } from "react-dom";
import { crearProveedor } from "../actions";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn sm:col-span-2 justify-self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar proveedor"}</button>;
}

/** Campo con su nombre arriba de la casilla. No hay texto de ayuda dentro
 *  (placeholder): la etiqueta es la que dice qué va en cada casilla, igual
 *  que en el formulario de editar proveedor. */
function Campo({
  name,
  etiqueta,
  ancho = "",
  ayuda,
  children,
}: {
  name: string;
  etiqueta: string;
  /** "sm:col-span-2" cuando el campo ocupa las dos columnas. */
  ancho?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={ancho}>
      <label htmlFor={name} className="block text-xs text-tinta2 mb-1 font-medium">{etiqueta}</label>
      {children}
      {ayuda && <p className="text-xs text-tinta2 mt-1">{ayuda}</p>}
    </div>
  );
}

export default function FormularioCrearProveedor() {
  const [estado, accion] = useFormState(crearProveedor, { error: null });

  return (
    <details className="tarjeta p-4 mb-5">
      {/* El resumen es el botón de "Agregar nuevo proveedor": verde como el
          resto de las acciones principales del sistema. */}
      <summary className="btn cursor-pointer select-none">+ Agregar nuevo proveedor</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-3 mt-4">
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}

        {/* Solo el nombre es obligatorio; el resto de campos son opcionales. */}
        <Campo name="nombre" etiqueta="Nombre o razón social *" ancho="sm:col-span-2">
          <input id="nombre" className="campo-input" name="nombre" required />
        </Campo>

        <Campo name="codigo" etiqueta="Código" ayuda="Se genera solo si lo dejas vacío (PROV-001…).">
          <input id="codigo" className="campo-input" name="codigo" />
        </Campo>

        <Campo name="tipoProducto" etiqueta="Tipo de producto">
          <input id="tipoProducto" className="campo-input" name="tipoProducto" />
        </Campo>

        <Campo name="rtn" etiqueta="RTN">
          <input id="rtn" className="campo-input" name="rtn" />
        </Campo>

        <Campo name="cuentaBancaria" etiqueta="Número de cuenta bancaria">
          <input id="cuentaBancaria" className="campo-input" name="cuentaBancaria" />
        </Campo>

        <Campo name="telefono" etiqueta="Teléfono">
          <input id="telefono" className="campo-input" name="telefono" />
        </Campo>

        <Campo name="contacto" etiqueta="Persona de contacto">
          <input id="contacto" className="campo-input" name="contacto" />
        </Campo>

        <Campo name="correo" etiqueta="Correo">
          <input id="correo" className="campo-input" name="correo" type="email" />
        </Campo>

        <Campo name="direccion" etiqueta="Dirección" ancho="sm:col-span-2">
          <input id="direccion" className="campo-input" name="direccion" />
        </Campo>

        <BotonGuardar />
      </form>
    </details>
  );
}
