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

/** Campo con su nombre arriba de la casilla (sin placeholder) y, si hace
 *  falta, una línea de ayuda debajo. Mismo estilo que el formulario de
 *  editar material. */
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

export default function FormularioCrearMaterial({
  proveedores,
  categorias,
}: {
  proveedores: Proveedor[];
  /** Categorías que ya existen en el catálogo, para la lista de Categoría. */
  categorias: string[];
}) {
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
      <summary className="btn cursor-pointer select-none">+ Nuevo material</summary>
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

        <Campo name="codigo" etiqueta="Código *" ayuda="Ej. MED-004.">
          <input id="codigo" className="campo-input" name="codigo" required />
        </Campo>

        {/* La categoría es un campo abierto con lista: al escribir aparecen
            las categorías que ya hay en el catálogo (list + datalist), pero
            también se puede escribir una nueva y quedará guardada. */}
        <Campo name="categoria" etiqueta="Categoría *" ayuda="Elige una categoría existente o escribe una nueva.">
          <input id="categoria" className="campo-input" name="categoria" list="categorias-material" required />
          <datalist id="categorias-material">
            {categorias.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Campo>

        <Campo name="nombre" etiqueta="Nombre del material *" ancho="sm:col-span-2" ayuda="Con la presentación completa (Ej. AGUA 12 ONZ, BOLSA PLASTICA 4X8).">
          <input id="nombre" className="campo-input" name="nombre" required />
        </Campo>

        <Campo name="unidad" etiqueta="Unidad *" ayuda="Cómo se pide y se cuenta (Ej. Caja de 100).">
          <input id="unidad" className="campo-input" name="unidad" required />
        </Campo>

        <Campo name="proveedorId" etiqueta="Proveedor">
          <select id="proveedorId" className="campo-input" name="proveedorId" defaultValue="">
            <option value="">Elige proveedor…</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>

        <Campo name="existencia" etiqueta="Existencia en bodega" ayuda="Déjalo vacío para que quede en 0.">
          <input id="existencia" className="campo-input" name="existencia" type="number" min={0} />
        </Campo>

        <Campo name="minimo" etiqueta="Mínimo para avisar faltantes" ayuda="Déjalo vacío para que quede en 0.">
          <input id="minimo" className="campo-input" name="minimo" type="number" min={0} />
        </Campo>

        <div className="sm:col-span-2 border-t border-borde pt-3">
          <label htmlFor="imagen" className="block text-sm text-tinta2 mb-1.5 font-medium">Imagen del producto</label>
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
                id="imagen"
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
