"use client";
import { useFormState, useFormStatus } from "react-dom";
import { descargarInventario } from "../actions";

type Material = { id: number; codigo: string; nombre: string; unidad: string; existencia: number };

function BotonDescargar() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" disabled={pending}>
      {pending ? "Descargando…" : "Descargar del inventario"}
    </button>
  );
}

/** Forma de salida de bodega: elige material, cantidad y motivo.
 *  `inicial` permite abrirlo con un material ya elegido (desde /materiales). */
export default function FormularioDescargo({
  materiales,
  inicial,
}: {
  materiales: Material[];
  inicial?: number;
}) {
  const [estado, accion] = useFormState(descargarInventario, { error: null });

  const elegido = materiales.find((m) => m.id === inicial) || materiales[0];
  const disponibles = materiales.filter((m) => m.existencia > 0);

  if (!materiales.length) {
    return (
      <div className="tarjeta p-6 mb-5 text-tinta2 text-sm">
        No hay materiales en el catálogo todavía.
      </div>
    );
  }

  return (
    <details className="tarjeta p-4 mb-5" open={Boolean(inicial)}>
      <summary className="cursor-pointer font-medium text-sm">+ Nuevo descargo (salida de bodega)</summary>
      <form action={accion} className="grid sm:grid-cols-2 gap-3 mt-4">
        {estado.error && (
          <div className="sm:col-span-2 bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>
        )}

        <label className="sm:col-span-2 block">
          <span className="block text-xs text-tinta2 mb-1">Material a descargar</span>
          <select className="campo-input" name="materialId" defaultValue={elegido?.id}>
            {materiales.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} — {m.nombre} (existencia: {m.existencia} {m.unidad})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-tinta2 mb-1">Cantidad a restar</span>
          <input className="campo-input" name="cantidad" type="number" min={1} step={1} placeholder="Ej. 5" required />
        </label>

        <label className="block">
          <span className="block text-xs text-tinta2 mb-1">Motivo o destino</span>
          <input className="campo-input" name="motivo" placeholder="Ej. Consumo de enfermería" required />
        </label>

        <p className="sm:col-span-2 text-xs text-tinta2">
          {disponibles.length === materiales.length
            ? "El descargo resta la existencia al instante y queda registrado con tu nombre en la bitácora."
            : "Hay materiales sin existencia; no podrán descargarse."}
        </p>

        <div className="sm:col-span-2">
          <BotonDescargar />
        </div>
      </form>
    </details>
  );
}
