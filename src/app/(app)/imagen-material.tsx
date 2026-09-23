"use client";
// Miniatura del producto reutilizada en el catálogo de materiales, en el
// formulario de órdenes y en el detalle de la orden. Si el material no
// tiene imagen (o la URL deja de responder), en vez del ícono de foto
// rota se muestra un recuadro neutro con una cámara.
import { useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  /** Clases de Tailwind para el tamaño, p. ej. "h-12 w-12". */
  className?: string;
};

export default function ImagenMaterial({ src, alt, className = "h-10 w-10" }: Props) {
  const [falla, setFalla] = useState(false);

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFalla(true)}
      className={`${className} shrink-0 rounded-lg border border-borde bg-superficie2 object-cover`}
    />
  );
}
