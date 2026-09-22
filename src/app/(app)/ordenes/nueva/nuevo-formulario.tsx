"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearOrden } from "../../actions";

type Proveedor = { id: number; nombre: string };
type Material = { id: number; codigo: string; nombre: string; precioUltimo: number };

function BotonEnviar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Enviando…" : "Enviar solicitud"}</button>;
}

export default function NuevoFormulario({
  proveedores, materiales,
}: { proveedores: Proveedor[]; materiales: Material[] }) {
  const [estado, accion] = useFormState(crearOrden, { error: null });
  const [lineas, setLineas] = useState([{ materialId: "", cantidad: 1, precio: 0 }]);

  function actualizar(i: number, campo: string, valor: string | number) {
    setLineas((prev) => {
      const copia = [...prev];
      // @ts-expect-error -- asignación dinámica de campo
      copia[i][campo] = valor;
      if (campo === "materialId") {
        const m = materiales.find((x) => x.id === Number(valor));
        if (m && !copia[i].precio) copia[i].precio = Number(m.precioUltimo);
      }
      return copia;
    });
  }
  function agregar() { setLineas((p) => [...p, { materialId: "", cantidad: 1, precio: 0 }]); }
  function quitar(i: number) { setLineas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p)); }

  const total = lineas.reduce((s, l) => s + Number(l.cantidad || 0) * Number(l.precio || 0), 0);
  const lps = (n: number) => "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form action={accion} className="tarjeta p-5 grid gap-4 max-w-2xl">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}

      <div className="grid sm:grid-cols-2 gap-3.5">
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Proveedor</label>
          <select className="campo-input" name="proveedorId" required>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">¿Para qué se necesita?</label>
          <input className="campo-input" name="justificacion" placeholder="Motivo de la compra" />
        </div>
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Dependencia</label>
          <input className="campo-input" name="dependencia" placeholder="Servicios de Salud" required />
        </div>
        <div>
          <label className="block text-sm text-tinta2 mb-1.5 font-medium">Lugar</label>
          <input className="campo-input" name="lugar" placeholder="Santa Rosa de Copán" required />
        </div>
      </div>

      <div>
        <label className="block text-sm text-tinta2 mb-1.5 font-medium">Materiales</label>
        {lineas.map((l, i) => (
          <div key={i} className="grid gap-2 mb-2" style={{ gridTemplateColumns: "1fr 90px 110px 34px" }}>
            <select className="campo-input" name="materialId" value={l.materialId}
              onChange={(e) => actualizar(i, "materialId", e.target.value)}>
              <option value="">Elige un material…</option>
              {materiales.map((m) => <option key={m.id} value={m.id}>{m.codigo} · {m.nombre}</option>)}
            </select>
            <input className="campo-input" type="number" name="cantidad" min={1} value={l.cantidad}
              onChange={(e) => actualizar(i, "cantidad", Number(e.target.value))} />
            <input className="campo-input" type="number" name="precio" min={0} step="0.01" value={l.precio}
              onChange={(e) => actualizar(i, "precio", Number(e.target.value))} />
            <button type="button" onClick={() => quitar(i)} className="border border-borde text-rojo rounded-lg" aria-label="Quitar">×</button>
          </div>
        ))}
        <button type="button" onClick={agregar} className="btn-secundario btn-chico">Agregar material</button>
      </div>

      <div className="flex justify-between border-t border-borde pt-3 font-semibold">
        <span>Total de la orden</span><span>{lps(total)}</span>
      </div>

      <div className="flex gap-2 justify-end">
        <a href="/ordenes" className="btn-secundario">Cancelar</a>
        <BotonEnviar />
      </div>
    </form>
  );
}
