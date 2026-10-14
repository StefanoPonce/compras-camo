"use client";

import { useRef, useState } from "react";
import { ACEPTA_ADJUNTOS, revisarAdjunto } from "../adjuntos-cliente";

/**
 * Casilla de "adjuntar" de un renglón de la requisición.
 *
 * Si el renglón ya tenía un adjunto guardado, lo muestra con su nombre y da
 * la opción de abrirlo, reemplazarlo o quitarlo. Si no, solo aparece el botón
 * para subir una foto o un PDF.
 *
 * Los nombres de los campos llevan el número de fila (adjunto_0,
 * quitarAdjunto_0) porque una casilla sin marcar no se envía en el formulario:
 * con un solo nombre para todas las filas, el "quitar" caería en la fila
 * equivocada.
 */
export default function AdjuntoRenglon({
  indice,
  nombreArchivo,
  accept = ACEPTA_ADJUNTOS,
  existente,
  nombreExistente,
  onMensaje,
}: {
  indice: number;
  /** Nombre del producto, solo para el texto del título del botón. */
  nombreArchivo: string;
  accept?: string;
  existente: string | null;
  nombreExistente: string | null;
  onMensaje: (mensaje: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [quitar, setQuitar] = useState(false);
  const [nuevo, setNuevo] = useState<string | null>(null);

  function alElegir(archivo: File | null) {
    if (!archivo) return;
    const problema = revisarAdjunto(archivo);
    if (problema) {
      // Se avisa y se vacía el input para que no quede un archivo inválido
      // escondido esperando a enviarse.
      onMensaje(problema);
      if (inputRef.current) inputRef.current.value = "";
      setNuevo(null);
      return;
    }
    onMensaje("");
    setNuevo(archivo.name);
    setQuitar(false);
  }

  const quitandose = !nuevo && (quitar || !existente);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {existente && !quitar && !nuevo && (
        <a
          href={existente}
          target="_blank"
          rel="noreferrer"
          className="etiqueta et-pendiente max-w-[120px] truncate"
          title={`Abrir ${nombreExistente || "el adjunto"}`}
        >
          {nombreExistente || "adjunto"}
        </a>
      )}

      {nuevo && (
        <span className="etiqueta et-aprobada max-w-[120px] truncate" title={nuevo}>
          {nuevo}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        name={"adjunto_" + indice}
        accept={accept}
        className="hidden"
        onChange={(e) => alElegir(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        className="btn-secundario btn-chico"
        onClick={() => inputRef.current?.click()}
        title={nombreArchivo ? "Adjuntar foto o documento a " + nombreArchivo : "Adjuntar foto o documento"}
      >
        {existente || nuevo ? "Cambiar" : "Adjuntar"}
      </button>

      {existente && !nuevo && (
        <label className="text-[11px] text-tinta2 flex items-center gap-1 whitespace-nowrap">
          <input type="checkbox" checked={quitar} onChange={(e) => setQuitar(e.target.checked)} />
          quitar
        </label>
      )}

      {nuevo && (
        <button
          type="button"
          className="text-[11px] text-rojo underline"
          onClick={() => {
            setNuevo(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          quitar
        </button>
      )}

      {/* La URL del adjunto guardado viaja en un campo oculto para que el
          servidor sepa cuál conservar. El servidor la valida: si no pertenece
          a esta requisición, la ignora. */}
      {!quitar && !nuevo && (
        <input type="hidden" name={"adjuntoActual_" + indice} value={existente || ""} />
      )}
      {/* Siempre viaja un valor, marcado o no, para no desalinear las filas. */}
      <input type="hidden" name={"quitarAdjunto_" + indice} value={quitar && !nuevo ? "1" : "0"} />
    </div>
  );
}
