import Image from "next/image";

// Encabezado que solo aparece en el papel (la clase `solo-impresion` lo
// esconde en pantalla y el CSS de impresión lo muestra). Va arriba del listado
// cuando el usuario lo guarda como PDF, para que se sepa qué reporte es, con
// qué filtros se armó y quién lo sacó.
//
// Se arma siempre igual, de arriba hacia abajo: el banner de CAMO
// (public/encabezado-camo.png) a todo el ancho de la hoja y, debajo, en una
// sola lista vertical, el título del reporte, de qué es, con qué filtros se
// sacó y quién lo generó. Es el encabezado de /reportes, /materiales y
// /proveedores: los tres usan este mismo componente.
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
      {/* El banner ya trae el logo y el nombre, así que no hace falta
          repetirlos en texto. `priority` lo descarga aunque esté oculto en
          pantalla: si no, el navegador podría no tenerlo listo al imprimir. */}
      <Image
        src="/encabezado-camo.png"
        alt="CAMO — Central American Medical Outreach"
        width={817}
        height={185}
        priority
        className="w-full h-auto"
      />
      <div className="text-center text-lg font-sora font-semibold mt-3">{titulo}</div>
      <div className="text-center text-tinta2 text-sm">
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
