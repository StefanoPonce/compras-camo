"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { EstadoForm } from "../actions";
import ImagenMaterial from "../imagen-material";
import AdjuntoRenglon from "./adjunto-renglon";
import { PROGRAMAS } from "@/lib/programas";
import { UNIDADES, etiquetaUnidad, normalizarUnidad } from "@/lib/unidades";

type MaterialOrden = {
  id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  variante: string | null;
  imagenUrl: string | null;
  proveedor: { id: number; nombre: string } | null;
};

export type LineaOrden = {
  materialId: number | "";
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  /** Programa de ESTE renglón, como código corto ("2.2"). */
  programa: string;
  /** Proveedor elegido para este renglón. Vacío = el material no tiene
   *  proveedor asignado y hay que escogerlo en la columna Proveedor. */
  proveedorId: number | "";
  imagenUrl: string | null;
  /** Adjunto que ya tenía este renglón guardado (al editar una requisición). */
  adjuntoUrl: string | null;
  adjuntoNombre: string | null;
};

type InicialOrden = {
  dependencia: string;
  lugar: string;
  justificacion: string;
  lineas: LineaOrden[];
};

type Proveedor = { id: number; nombre: string };

type FormularioProps = {
  accion: (prev: EstadoForm, datos: FormData) => Promise<EstadoForm>;
  materiales: MaterialOrden[];
  proveedores: Proveedor[];
  inicial?: InicialOrden;
  cancelarHref?: string;
  textoEnviar?: string;
  /** Muestra el botón de guardar como borrador. Se oculta al editar una
   *  requisición que ya se envió (aprobada), porque esa no vuelve a borrador. */
  permitirBorrador?: boolean;
};

function lineaVacia(): LineaOrden {
  return {
    materialId: "", codigo: "", nombre: "", categoria: "", unidad: "",
    cantidad: 1, programa: "", proveedorId: "", imagenUrl: null,
    adjuntoUrl: null, adjuntoNombre: null,
  };
}

/** El <select> de unidad, que se pinta una vez por renglón. */
function SelectUnidad({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  // Si el renglón trae una unidad que no está en el catálogo (alguien la
  // inventó), se agrega arriba para no perderla al guardar.
  const lista = UNIDADES.includes(valor as never) ? [...UNIDADES] : [valor, ...UNIDADES];
  return (
    <select
      className="campo-input"
      name="unidad"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      title={valor && !UNIDADES.includes(valor as never) ? "Unidad fuera del catálogo: " + valor : "Unidad de medida"}
    >
      {lista.map((u) => (
        <option key={u} value={u}>{etiquetaUnidad(u)}</option>
      ))}
    </select>
  );
}

function BotonEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending} name="intento" value="enviar">{pending ? "Enviando…" : texto}</button>;
}

/** Botón de "Guardar borrador": deja la requisición a medias sin exigir lo que
 *  falte, para retomarla más adelante. Viaja en el mismo formulario, así que
 *  `formNoValidate` desactiva los campos `required` del navegador (si no, no
 *  dejaría guardar un borrador sin dependencia o sin programa). El campo
 *  `intento=borrador` le dice al servidor que no es un envío. */
function BotonBorrador() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-secundario" disabled={pending} name="intento" value="borrador" formNoValidate>
      {pending ? "Guardando…" : "Guardar borrador"}
    </button>
  );
}

/** El <select> de programa, que se pinta una vez por renglón. */
function SelectPrograma({
  valor,
  onChange,
  id,
}: {
  valor: string;
  onChange: (valor: string) => void;
  id: string;
}) {
  return (
    <select className="campo-input" name="programa" required value={valor} onChange={(e) => onChange(e.target.value)} id={id}>
      <option value="">Elige un programa…</option>
      {PROGRAMAS.map((grupo) => (
        <optgroup key={grupo.grupo} label={grupo.grupo}>
          {grupo.programas.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.codigo} {p.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function FormularioOrden({ accion, materiales, proveedores, inicial, cancelarHref = "/ordenes", textoEnviar = "Enviar requisición", permitirBorrador = true }: FormularioProps) {
  const [estado, envia] = useFormState(accion, { error: null });
  // Un borrador puede haberse guardado sin ningún material, y `[]` es
  // verdadero en JavaScript: sin el largo, una lista vacía dejaría la tabla
  // sin filas y no habría dónde escribir. Se cae a una fila en blanco.
  const [lineas, setLineas] = useState<LineaOrden[]>(
    inicial?.lineas?.length ? inicial.lineas : [lineaVacia()]
  );
  const [avisoAdjunto, setAvisoAdjunto] = useState("");

  function cambiar(i: number, cambios: Partial<LineaOrden>) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], ...cambios };
      return copia;
    });
  }

  function alElegirMaterial(i: number, valor: string) {
    const nuevoId = Number(valor);
    const m = materiales.find((x) => x.id === nuevoId);
    if (!m) {
      cambiar(i, { materialId: "", codigo: "", nombre: "", categoria: "", unidad: "", proveedorId: "", imagenUrl: null });
      return;
    }
    const l = lineas[i];
    cambiar(i, {
      materialId: m.id,
      codigo: m.codigo,
      nombre: m.nombre,
      categoria: m.categoria,
      // Al elegir un material se propone la unidad del catálogo. El solicitante
      // puede cambiarla si va a comprar distinto; si este renglón ya tenía una
      // elegida, se respeta su elección.
      unidad: l.materialId === m.id ? l.unidad : normalizarUnidad(m.unidad),
      // Al cambiar de material se toma su proveedor; si no tiene, queda vacío y
      // hay que elegirlo en la columna Proveedor. El programa y el adjunto NO
      // se tocan: son de este renglón, no del material.
      proveedorId: l.materialId === m.id ? l.proveedorId : (m.proveedor?.id ?? ""),
      imagenUrl: m.imagenUrl,
    });
  }

  function agregar() { setLineas((p) => [...p, lineaVacia()]); }
  function quitar(i: number) { setLineas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p)); }

  // Sin importes: el resumen es la suma de unidades pedidas.
  const unidades = lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0);
  const elegidos = lineas.filter((l) => l.materialId).length;
  const sinPrograma = lineas.filter((l) => l.materialId && !l.programa).length;
  // El proveedor es opcional: si ningún renglón lo trae, la requisición se
  // guarda sin él y en la consolidación sale en un grupo aparte.

  return (
    <form action={envia} className="tarjeta p-5 grid gap-4 max-w-5xl">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}

      <div className="grid sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Dependencia</label>
          <select className="campo-input" name="dependencia" required defaultValue={inicial?.dependencia || ""}>
            <option value="">Selecciona una dependencia…</option>
            <option value="direccion">Dirección</option>
            <option value="subdireccion">Subdirección</option>
            <option value="gerente financiero">Gerente Financiero</option>
            <option value="gerente educacion y talento humano">Gerente Educación y Talento Humano</option>
            <option value="gerente mercadeo">Gerente Mercadeo</option>
            <option value="gerente biomedica">Gerente Biomédica</option>
            <option value="gerente operaciones">Gerente Operaciones</option>
            <option value="gerente salud">Gerente Salud</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Observaciones</label>
          <input className="campo-input" name="justificacion" placeholder="" defaultValue={inicial?.justificacion || ""} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <label className="block text-sm text-tinta2 mb-1.5 font-medium">Productos y materiales</label>
        <p className="text-xs text-tinta2 mb-2">
          Elige cada producto o material de la lista; su categoría y unidad se llenan solos. Elige el programa al que
          se carga cada material: una misma requisición puede llevar materiales de programas distintos. El proveedor
          es opcional. Con <strong>Adjuntar</strong> puedes subir una foto o un documento (PDF, hasta 8 MB) de ese
          material.
        </p>

        <div
          className="grid gap-x-2 gap-y-1.5 mb-1.5 items-center"
          style={{ gridTemplateColumns: "150px minmax(190px, 2fr) minmax(120px, 0.9fr) 70px 100px minmax(150px, 1.1fr) minmax(140px, 1fr) 34px", minWidth: 1020 }}
        >
          <div className="text-xs text-tinta2 font-semibold">Imagen / adjunto</div>
          <div className="text-xs text-tinta2 font-semibold">Producto / material</div>
          <div className="text-xs text-tinta2 font-semibold">Categoría</div>
          <div className="text-xs text-tinta2 font-semibold text-right">Cant.</div>
          <div className="text-xs text-tinta2 font-semibold">Unidad</div>
          <div className="text-xs text-tinta2 font-semibold">Programa</div>
          <div className="text-xs text-tinta2 font-semibold">Proveedor</div>
          <div></div>

          {lineas.map((l, i) => (
            <div key={i} className="contents">
              {/* La foto del catálogo del material y, al lado, la casilla para
                  que el solicitante adjunte su propia foto o documento. */}
              <div className="flex items-center gap-2">
                <ImagenMaterial src={l.imagenUrl} alt={l.nombre || "Material elegido"} className="h-9 w-9 shrink-0" />
                <AdjuntoRenglon
                  indice={i}
                  nombreArchivo={l.nombre}
                  existente={l.adjuntoUrl}
                  nombreExistente={l.adjuntoNombre}
                  onMensaje={setAvisoAdjunto}
                />
              </div>

              <select
                className="campo-input font-mono"
                name="materialId"
                value={l.materialId === "" ? "" : String(l.materialId)}
                onChange={(e) => alElegirMaterial(i, e.target.value)}
              >
                <option value="">Elige un material…</option>
                {materiales.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} · {m.nombre}
                    {m.variante ? ` — ${m.variante}` : ""}
                  </option>
                ))}
              </select>

              <input
                className="campo-input"
                placeholder="Categoría"
                value={l.categoria}
                readOnly
                tabIndex={-1}
                title="La categoría proviene del catálogo de materiales"
              />

              <input
                className="campo-input text-right"
                type="number"
                name="cantidad"
                min={1}
                value={l.cantidad}
                onChange={(e) => cambiar(i, { cantidad: Number(e.target.value) })}
              />

              <SelectUnidad valor={l.unidad} onChange={(valor) => cambiar(i, { unidad: valor })} />

              <SelectPrograma
                valor={l.programa}
                onChange={(valor) => cambiar(i, { programa: valor })}
                id={"programa-" + i}
              />

              <select
                className="campo-input"
                name="proveedorId"
                value={l.proveedorId === "" ? "" : String(l.proveedorId)}
                onChange={(e) => cambiar(i, { proveedorId: e.target.value === "" ? "" : Number(e.target.value) })}
              >
                <option value="">Elige proveedor (opcional)…</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>

              <button type="button" onClick={() => quitar(i)} className="border border-borde text-rojo rounded-lg h-9" aria-label="Quitar">×</button>
            </div>
          ))}
        </div>

        <button type="button" onClick={agregar} className="btn-secundario btn-chico">Agregar material</button>

        {avisoAdjunto && <p className="text-rojo text-xs mt-2">{avisoAdjunto}</p>}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-tinta2">Total de unidades:</span>
        <strong className="font-sora text-lg">{unidades.toLocaleString("es-HN")}</strong>
        <span className="text-tinta2 text-xs">({elegidos} material(es) elegido(s))</span>
        {sinPrograma > 0 && (
          <span className="text-rojo text-xs">
            · falta elegir el programa de {sinPrograma} material(es)
          </span>
        )}
      </div>

      <p className="text-xs text-tinta2 italic">
        {permitirBorrador
          ? "Puedes guardarla como borrador y completarla más tarde sin perder lo escrito. Una vez enviada la Requisición no se podrá editar a menos que sea rechazada."
          : "Una vez enviada la Requisición no se podrá editar a menos que sea rechazada."}
      </p>

      <div className="flex gap-2 justify-end flex-wrap">
        <a href={cancelarHref} className="btn-secundario">Cancelar</a>
        {permitirBorrador && <BotonBorrador />}
        <BotonEnviar texto={textoEnviar} />
      </div>
    </form>
  );
}
