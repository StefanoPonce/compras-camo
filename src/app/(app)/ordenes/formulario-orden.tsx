"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { EstadoForm } from "../actions";
import ImagenMaterial from "../imagen-material";

type MaterialOrden = {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  variante: string | null;
  precioUltimo: number;
  imagenUrl: string | null;
  proveedor: { id: number; nombre: string } | null;
};

export type LineaOrden = {
  materialId: number | "";
  codigo: string;
  nombre: string;
  unidad: string;
  precio: number;
  cantidad: number;
  /** Proveedor elegido para este renglón. Vacío = el material no tiene
   *  proveedor asignado y hay que escogerlo en la columna Proveedor. */
  proveedorId: number | "";
  imagenUrl: string | null;
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
};

function lineaVacia(): LineaOrden {
  return { materialId: "", codigo: "", nombre: "", unidad: "", precio: 0, cantidad: 1, proveedorId: "", imagenUrl: null };
}

function BotonEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Enviando…" : texto}</button>;
}

export default function FormularioOrden({ accion, materiales, proveedores, inicial, cancelarHref = "/ordenes", textoEnviar = "Enviar solicitud" }: FormularioProps) {
  const [estado, envia] = useFormState(accion, { error: null });
  const [lineas, setLineas] = useState<LineaOrden[]>(inicial?.lineas || [lineaVacia()]);

  function alElegirMaterial(i: number, valor: string) {
    const nuevoId = Number(valor);
    setLineas((prev) => {
      const copia = [...prev];
      const l = copia[i];
      const m = materiales.find((x) => x.id === nuevoId);
      if (!m) {
        copia[i] = { ...l, materialId: "", codigo: "", nombre: "", unidad: "", proveedorId: "", imagenUrl: null };
        return copia;
      }
      copia[i] = {
        ...l,
        materialId: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
        unidad: m.unidad,
        precio: l.materialId === m.id ? l.precio : Number(m.precioUltimo),
        // Al cambiar de material se toma su proveedor; si no tiene, queda
        // vacío y hay que elegirlo en la columna Proveedor.
        proveedorId: l.materialId === m.id ? l.proveedorId : (m.proveedor?.id ?? ""),
        imagenUrl: m.imagenUrl,
      };
      return copia;
    });
  }

  function cambiarProveedor(i: number, valor: string) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], proveedorId: valor === "" ? "" : Number(valor) };
      return copia;
    });
  }

  function actualizarLinea(i: number, campo: "cantidad" | "precio", valor: number) {
    setLineas((prev) => {
      const copia = [...prev];
      copia[i] = { ...copia[i], [campo]: valor };
      return copia;
    });
  }

  function agregar() { setLineas((p) => [...p, lineaVacia()]); }
  function quitar(i: number) { setLineas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p)); }

  const total = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.precio || 0), 0);
  const lps = (n: number) => "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form action={envia} className="tarjeta p-5 grid gap-4 max-w-4xl">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}

      <div className="grid sm:grid-cols-3 gap-3.5">
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">¿Para qué se necesita?</label>
          <input className="campo-input" name="justificacion" placeholder="Motivo de la compra" defaultValue={inicial?.justificacion || ""} />
        </div>
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Dependencia</label>
          <input className="campo-input" name="dependencia" placeholder="Servicios de Salud" required defaultValue={inicial?.dependencia || ""} />
        </div>
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Lugar</label>
          <input className="campo-input" name="lugar" placeholder="Santa Rosa de Copán" required defaultValue={inicial?.lugar || ""} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <label className="block text-sm text-tinta2 mb-1.5 font-medium">Materiales</label>
        <p className="text-xs text-tinta2 mb-2">
          Elige cada material de la lista; la unidad y el precio se llenan solos. El proveedor se completa con el del material
          y, si el material no tiene, escógelo en esa misma columna.
        </p>
        <div className="grid gap-x-2 gap-y-1.5 mb-1.5" style={{ gridTemplateColumns: "54px minmax(210px, 2fr) 120px 1fr 64px 100px 34px", minWidth: 760 }}>
          <div className="text-xs text-tinta2 font-semibold">Imagen</div>
          <div className="text-xs text-tinta2 font-semibold">Material (código · producto)</div>
          <div className="text-xs text-tinta2 font-semibold">Unidad</div>
          <div className="text-xs text-tinta2 font-semibold">Proveedor</div>
          <div className="text-xs text-tinta2 font-semibold text-right">Cant.</div>
          <div className="text-xs text-tinta2 font-semibold text-right">Precio</div>
          <div></div>
          {lineas.map((l, i) => (
            <div key={i} className="contents">
              <ImagenMaterial src={l.imagenUrl} alt={l.nombre || "Material elegido"} className="h-9 w-9" />
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
              <input className="campo-input" placeholder="Unidad" value={l.unidad} readOnly tabIndex={-1} />
              <select
                className="campo-input"
                name="proveedorId"
                value={l.proveedorId === "" ? "" : String(l.proveedorId)}
                onChange={(e) => cambiarProveedor(i, e.target.value)}
                required={l.materialId !== "" && l.proveedorId === ""}
              >
                <option value="">Elige proveedor…</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input className="campo-input text-right" type="number" name="cantidad" min={1} value={l.cantidad} onChange={(e) => actualizarLinea(i, "cantidad", Number(e.target.value))} />
              {/* Sin precio registrado (sin material o en 0) el campo queda en
                  blanco para que el placeholder explique qué va ahí. */}
              <input
                className="campo-input text-right" type="number" name="precio" min={0} step="0.01"
                value={l.materialId === "" || l.precio === 0 ? "" : l.precio}
                placeholder="Precio unitario (L)"
                onChange={(e) => actualizarLinea(i, "precio", Number(e.target.value))}
              />
              <button type="button" onClick={() => quitar(i)} className="border border-borde text-rojo rounded-lg h-9" aria-label="Quitar">×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={agregar} className="btn-secundario btn-chico">Agregar material</button>
      </div>

      <div className="flex justify-between border-t border-borde pt-3 font-semibold">
        <span>Total de la orden</span><span>{lps(total)}</span>
      </div>

      <div className="flex gap-2 justify-end">
        <a href={cancelarHref} className="btn-secundario">Cancelar</a>
        <BotonEnviar texto={textoEnviar} />
      </div>
    </form>
  );
}