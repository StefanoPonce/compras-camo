"use client";
// Filtro por categoría del módulo Compras: al elegir una categoría se
// recarga la página con el parámetro en la URL, de modo que el filtro queda
// guardado (se puede copiar el enlace o volver atrás) y no se pierde al
// cambiar el estado de un material.
import { useRouter } from "next/navigation";

export default function FiltroCategoria({
  categorias,
  valor,
}: {
  categorias: string[];
  valor: string;
}) {
  const router = useRouter();

  return (
    <select
      className="campo-input max-w-[240px]"
      aria-label="Filtrar por categoría"
      value={valor}
      onChange={(evento) => {
        const categoria = evento.target.value;
        const params = new URLSearchParams(window.location.search);
        if (categoria) params.set("categoria", categoria);
        else params.delete("categoria");
        const query = params.toString();
        router.replace(`/compras${query ? `?${query}` : ""}`);
      }}
    >
      <option value="">Todas las categorías</option>
      {categorias.map((categoria) => (
        <option key={categoria} value={categoria}>
          {categoria}
        </option>
      ))}
    </select>
  );
}
