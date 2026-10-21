import Image from "next/image";

// Encabezado que solo aparece en el papel (la clase `solo-impresion` lo
// esconde en pantalla y el CSS de impresión lo muestra). Va arriba del listado
// cuando el usuario lo guarda como PDF, para que se sepa qué reporte es, con
// qué filtros se armó y quién lo sacó.
export default function EncabezadoImpresion({
  titulo,
  descripcion,
  filtros,
  usuario,
}: {
  titulo: string;
  descripcion: string;
  filtros?: string;
  usuario?: string;
}) {
  const generado = new Date().toLocaleString("es-HN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="solo-impresion mb-6">
      <div className="flex justify-center mb-1">
        <Image src="/logo-camo.png" alt="Logo Fundación CAMO" width={110} height={110} priority />
      </div>
      <div className="text-center text-lg font-sora font-semibold">Fundación CAMO</div>
      <div className="text-center text-tinta2 text-sm">{titulo}</div>
      <div className="text-center text-tinta2 text-xs mt-1">
        {descripcion}
        {filtros ? ` · ${filtros}` : ""}
      </div>
      <div className="text-center text-tinta2 text-xs mt-0.5">
        Generado el {generado}
        {usuario ? ` por ${usuario}` : ""}
      </div>
      <hr className="my-3 border-borde" />
    </div>
  );
}
