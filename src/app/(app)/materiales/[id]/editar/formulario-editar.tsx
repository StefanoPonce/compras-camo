"use client";
import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { editarMaterial } from "../../../actions";
import { ACEPTA_IMAGENES, comprimirImagen, esImagenValida } from "../../../imagenes-cliente";

type Material = {
  id: number; codigo: string; nombre: string; categoria: string; unidad: string;
  existencia: number; minimo: number; proveedorId: number | null;
  imagenUrl: string | null;
};
type Proveedor = { id: number; nombre: string };

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

export default function FormularioEditarMaterial({
  m,
  proveedores,
  categorias,
}: {
  m: Material;
  proveedores: Proveedor[];
  /** Categorías que ya existen en el catálogo, para la lista de Categoría. */
  categorias: string[];
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
        <Campo name="codigo" etiqueta="Código *">
          <input id="codigo" className="campo-input" name="codigo" defaultValue={m.codigo} required />
        </Campo>
        {/* Campo abierto con lista: sugiere las categorías que ya hay y
            permite escribir una nueva. */}
        <Campo name="categoria" etiqueta="Categoría *" ayuda="Elige una existente o escribe una nueva.">
          <input id="categoria" className="campo-input" name="categoria" list="categorias-material" defaultValue={m.categoria} required />
          <datalist id="categorias-material">
            {categorias.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Campo>
      </div>
      <Campo name="nombre" etiqueta="Nombre del material *">
        <input id="nombre" className="campo-input" name="nombre" defaultValue={m.nombre} required />
      </Campo>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Campo name="unidad" etiqueta="Unidad *" ayuda="Cómo se pide y se cuenta en bodega.">
          <input id="unidad" className="campo-input" name="unidad" defaultValue={m.unidad} required />
        </Campo>
        {/* Sin proveedor asignado el select quedaría en blanco sin decir
            nada: la opción vacía explica para qué es el campo. */}
        <Campo name="proveedorId" etiqueta="Proveedor">
          <select id="proveedorId" className="campo-input" name="proveedorId" defaultValue={m.proveedorId ?? ""}>
            <option value="">Elige proveedor…</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        {/* Si el valor es 0 se deja el campo en blanco; guardar en blanco
            conserva la existencia o el mínimo que ya tiene. */}
        <Campo name="existencia" etiqueta="Existencia en bodega" ayuda="Déjalo vacío para no cambiarla.">
          <input
            id="existencia"
            className="campo-input"
            name="existencia"
            type="number"
            min={0}
            defaultValue={m.existencia || ""}
          />
        </Campo>
        <Campo name="minimo" etiqueta="Mínimo que se mantiene" ayuda="Debajo de esto el sistema avisa que hace falta. Déjalo vacío para no cambiarlo.">
          <input
            id="minimo"
            className="campo-input"
            name="minimo"
            type="number"
            min={0}
            defaultValue={m.minimo || ""}
          />
        </Campo>
      </div>

      <div className="border-t border-borde pt-3">
        <label htmlFor="imagen" className="block text-sm text-tinta2 mb-1.5 font-medium">Imagen del producto</label>
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
              id="imagen"
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
