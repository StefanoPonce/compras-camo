"use client";
// Si /public/logo-camo.png no existe todavía, oculta el espacio en vez
// de mostrar el ícono de imagen rota — así no se ve feo mientras la
// fundación no ha subido su logo real.
import { useState } from "react";

export default function ImagenLogo() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-camo.png"
      alt="Fundación CAMO"
      className="h-16 w-16 object-contain mx-auto mb-2"
      onError={() => setVisible(false)}
    />
  );
}
