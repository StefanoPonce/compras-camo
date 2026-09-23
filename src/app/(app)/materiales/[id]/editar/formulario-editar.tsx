"use client";
import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { editarMaterial } from "../../../actions";
import { ACEPTA_IMAGENES, comprimirImagen, esImagenValida } from "../../../imagenes-cliente";

type Material = {
  id: number; codigo: string; nombre: string; categoria: string; unidad: string;
  familia: string | null; variante: string | null;
  existencia: number; minimo: number; precioUltimo: number; proveedorId: number | null;
  imagenUrl: string | null;
};
type Proveedor = { id: number; nombre: string };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

export default function FormularioEditarMaterial({
  m,
  proveedores,
  familias,
}: {
  m: Material;
  proveedores: Proveedor[];
  familias: string[];
}) {
  const accion = editarMaterial.bind(null, m.id);
  const [estado, ejecutar] = useFormState(accion, { error: null });

  // Imagen nueva elegida (viaje comprimido dentro del FormData) y casilla
  // para eliminar la que ya tenía el material.
  const [imagen, setImagen] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [quitar, setQuitar] = useState(false);
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
    setQuitar(false); // una imagen nueva anula la casilla de quitar
    setAvisoImagen(null);
  }

  function limpiarImagen() {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    setImagen(null);
    setVistaPrevia(null);
    if (inputImagen.current) inputImagen.current.value = "";
  }

  const verImagenActual = !imagen && !quitar && m.imagenUrl;
  const mostrarVistaPrevia = Boolean(vistaPrevia) || Boolean(verImagenActual);
  const origen = vistaPrevia || (verImagenActual ? m.imagenUrl : null);

  return (
    <form
      action={(datos) => {
        if (imagen) datos.set("imagen", imagen, imagen.name);
        ejecutar(datos);
      }}
      className="tarjeta p-5 grid gap-3.5"
    >
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input className="campo-input" name="codigo" placeholder="Código (MED-004)" defaultValue={m.codigo} required />
        <input className="campo-input" name="categoria" placeholder="Categoría" defaultValue={m.categoria} required />
      </div>
      <input className="campo-input" name="nombre" placeholder="Nombre del material" defaultValue={m.nombre} required />
      {/* Familia = producto base; la variante es la presentación concreta.
          El datalist deja elegir entre las familias ya usadas. */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input className="campo-input" name="familia" list="familias-existentes" placeholder="Producto (familia)" defaultValue={m.familia || ""} />
        <input className="campo-input" name="variante" placeholder="Variante (4X8, 150 ml, BOTE)" defaultValue={m.variante || ""} />
        <datalist id="familias-existentes">
          {familias.map((f) => <option key={f} value={f} />)}
        </datalist>
      </div>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input className="campo-input" name="unidad" placeholder="Unidad (Caja de 100)" defaultValue={m.unidad} required />
        {/* Sin proveedor asignado el select quedaría en blanco sin decir
            nada: la opción vacía explica para qué es el campo. */}
        <select className="campo-input" name="proveedorId" defaultValue={m.proveedorId ?? ""}>
          <option value="">Elige proveedor…</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {/* Si el valor es 0 se deja el campo en blanco para que el placeholder
            explique para qué sirve; guardar en blanco conserva el valor actual. */}
        <input
          className="campo-input" name="existencia" type="number" min={0}
          defaultValue={m.existencia || ""}
          placeholder="Existencia en bodega (vacío = la que ya tiene)"
        />
        <input
          className="campo-input" name="minimo" type="number" min={0}
          defaultValue={m.minimo || ""}
          placeholder="Mínimo para avisar faltantes (vacío = el que ya tiene)"
        />
      </div>
      <input
        className="campo-input" name="precio" type="number" min={0} step="0.01"
        defaultValue={m.precioUltimo || ""}
        placeholder="Precio unitario en L. Ej. 12.50 (vacío = el que ya tiene)"
      />

      <div className="border-t border-borde pt-3">
        <label className="block text-sm text-tinta2 mb-1.5 font-medium">Imagen del producto</label>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-24 w-24 shrink-0 rounded-lg border border-borde bg-superficie2 overflow-hidden flex items-center justify-center text-tinta2">
            {mostrarVistaPrevia && origen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={origen} alt={`Imagen de ${m.nombre}`} className="h-full w-full object-cover" />
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
            <p className="text-xs text-tinta2">JPG, PNG o WEBP. Si no eliges ninguna, se conserva la actual.</p>
            {avisoImagen && <p className="text-xs text-rojo">{avisoImagen}</p>}
            <label className="flex items-center gap-2 text-sm text-tinta2">
              <input
                type="checkbox"
                name="quitarImagen"
                value="1"
                checked={quitar}
                disabled={Boolean(imagen)}
                onChange={(e) => setQuitar(e.target.checked)}
              />
              Quitar la imagen actual
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <a href="/materiales" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
