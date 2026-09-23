"use client";
import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearMaterial } from "../actions";
import { ACEPTA_IMAGENES, comprimirImagen, esImagenValida } from "../imagenes-cliente";

type Proveedor = { id: number; nombre: string };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn sm:col-span-2 justify-self-start" disabled={pending}>{pending ? "Guardando…" : "Guardar material"}</button>;
}

export default function FormularioCrearMaterial({ proveedores, familias }: { proveedores: Proveedor[]; familias: string[] }) {
  const [estado, accion] = useFormState(crearMaterial, { error: null });
  // La imagen viaja comprimida desde el navegador: se guarda en el estado
  // y se pega al FormData justo antes de mandar la acción del servidor.
  const [imagen, setImagen] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [avisoImagen, setAvisoImagen] = useState<string | null>(null);
  const inputImagen = useRef<HTMLInputElement>(null);

  async function alElegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return limpiarImagen();

    const invalida = await esImagenValida(archivo);
    if (invalida) {
      limpiarImagen();
      setAvisoImagen(invalida);
      return;
    }

    const reducida = await comprimirImagen(archivo);
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    setImagen(reducida);
    setVistaPrevia(URL.createObjectURL(reducida));
    setAvisoImagen(null);
  }

  function limpiarImagen() {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    setImagen(null);
    setVistaPrevia(null);
    if (inputImagen.current) inputImagen.current.value = "";
  }

  return (
    <details className="tarjeta p-4 mb-5">
      <summary className="cursor-pointer font-medium text-sm">+ Nuevo material</summary>
      <form
        action={(datos) => {
          if (imagen) datos.set("imagen", imagen, imagen.name);
          accion(datos);
        }}
        className="grid sm:grid-cols-2 gap-3 mt-4"
      >
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}
        <input className="campo-input" name="codigo" placeholder="Código (MED-004)" required />
        <input className="campo-input" name="categoria" placeholder="Categoría" required />
        <input className="campo-input sm:col-span-2" name="nombre" placeholder="Nombre del material" required />
        {/* Familia = producto base, variante = presentación (4X8, 150 ml, BOTE).
            El datalist sugiere las familias ya usadas para que no se dupliquen
            por erratas. Ambos quedan vacíos si el producto no tiene variantes. */}
        <input className="campo-input" name="familia" list="familias-existentes" placeholder="Producto (familia). Ej. BOLSA PLASTICA" />
        <input className="campo-input" name="variante" placeholder="Variante. Ej. 4X8, 150 ml, BOTE" />
        <datalist id="familias-existentes">
          {familias.map((f) => <option key={f} value={f} />)}
        </datalist>
        <input className="campo-input" name="unidad" placeholder="Unidad (Caja de 100)" required />
        <select className="campo-input" name="proveedorId">
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input className="campo-input" name="existencia" type="number" min={0} placeholder="Existencia en bodega (vacío = 0)" />
        <input className="campo-input" name="minimo" type="number" min={0} placeholder="Mínimo para avisar faltantes (vacío = 0)" />
        <input className="campo-input" name="precio" type="number" min={0} step="0.01" placeholder="Precio unitario en L. Ej. 12.50 (vacío = 0)" />

        <div className="sm:col-span-2 border-t border-borde pt-3">
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Imagen del producto</label>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-20 w-20 shrink-0 rounded-lg border border-borde bg-superficie2 overflow-hidden flex items-center justify-center text-tinta2">
              {vistaPrevia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vistaPrevia} alt="Vista previa del producto" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-center px-1">Sin imagen</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <input
                ref={inputImagen}
                className="campo-input max-w-[260px]"
                type="file"
                name="imagen"
                accept={ACEPTA_IMAGENES}
                onChange={alElegirImagen}
              />
              <p className="text-xs text-tinta2">JPG, PNG o WEBP. Se reduce automáticamente a 1200 px.</p>
              {avisoImagen && <p className="text-xs text-rojo">{avisoImagen}</p>}
              {imagen && (
                <button type="button" className="btn-secundario btn-chico justify-self-start" onClick={limpiarImagen}>
                  Quitar imagen
                </button>
              )}
            </div>
          </div>
        </div>

        <BotonGuardar />
      </form>
    </details>
  );
}
