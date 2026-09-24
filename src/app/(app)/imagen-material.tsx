"use client";
// Miniatura del producto reutilizada en el catálogo de materiales, en el
// formulario de órdenes y en el detalle de la orden. Si el material no
// tiene imagen (o la URL deja de responder), en vez del ícono de foto
// rota se muestra un recuadro neutro con una cámara. Cuando sí tiene foto,
// se puede abrir en tamaño grande para identificar mejor el material.
import { useEffect, useRef, useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  /** Clases de Tailwind para el tamaño, p. ej. "h-12 w-12". */
  className?: string;
};

export default function ImagenMaterial({ src, alt, className = "h-10 w-10" }: Props) {
  const [urlFallida, setUrlFallida] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);
  const botonImagen = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const falla = Boolean(src) && urlFallida === src;

  useEffect(() => {
    // Si cambia el material de la línea, no debe quedar abierta la foto del
    // material anterior.
    setAmpliada(false);
  }, [src]);

  useEffect(() => {
    if (!ampliada || !src) return;

    const elementoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAmpliada(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alPresionarTecla);
    const enfocar = window.requestAnimationFrame(() => botonCerrar.current?.focus());

    return () => {
      window.cancelAnimationFrame(enfocar);
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", alPresionarTecla);
      elementoAnterior?.focus();
    };
  }, [ampliada, src]);

  if (!src || falla) {
    return (
      <span
        role="img"
        aria-label={`Sin imagen de ${alt}`}
        title={`Sin imagen de ${alt}`}
        className={`${className} inline-flex shrink-0 items-center justify-center rounded-lg border border-borde bg-superficie2 text-tinta2`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-1/2 w-1/2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m4 17 4.5-4.5 3 3L15 11l5 5" />
        </svg>
      </span>
    );
  }

  return (
    <>
      <button
        ref={botonImagen}
        type="button"
        onClick={() => setAmpliada(true)}
        className={`${className} group relative inline-flex shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-borde bg-superficie2 p-0 focus:outline-none focus:ring-2 focus:ring-verde focus:ring-offset-2`}
        title={`Ampliar imagen de ${alt}`}
        aria-label={`Ampliar imagen de ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setUrlFallida(src)}
          className="h-full w-full shrink-0 object-cover"
        />
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-tinta/75 text-white opacity-80 transition-opacity group-hover:opacity-100" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 4 4M10.5 7.5v6M7.5 10.5h6" />
          </svg>
        </span>
      </button>

      {ampliada && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-tinta/90 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setAmpliada(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Imagen de ${alt}`}
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-superficie shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{alt}</p>
                <p className="text-xs text-tinta2">Imagen ampliada del material</p>
              </div>
              <button
                ref={botonCerrar}
                type="button"
                onClick={() => setAmpliada(false)}
                className="btn-secundario btn-chico shrink-0"
                aria-label="Cerrar imagen"
              >
                Cerrar
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-superficie2 p-3 sm:p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                decoding="async"
                onError={() => setUrlFallida(src)}
                className="max-h-[calc(92vh-6.5rem)] max-w-full object-contain"
              />
            </div>
            <p className="px-4 py-2 text-center text-xs text-tinta2">Clic fuera de la imagen o presiona Esc para cerrar</p>
          </div>
        </div>
      )}
    </>
  );
}
