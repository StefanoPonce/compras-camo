import { colorDeCiclo, ETIQUETAS_CICLO, ORDEN_CICLO, type CantidadesCiclo } from "@/lib/estado-gestion";

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

/**
 * Desglose de una cantidad por estado del ciclo de vida: "Gestionado: 8 ·
 * En proceso de compra: 4". Los estados con cantidad en cero no se listan,
 * para no escribir "Gestionado: 0" en una fila que todavía no se ha tocado.
 *
 * Lo comparten la columna "Cantidad consolidada" (módulos Gestión y Compras)
 * y el detalle de la requisición. En ambos casos los números salen de los
 * renglones de detalle_orden, así que la suma del desglose siempre coincide
 * con la cifra que tiene al lado.
 */
export default function DesgloseCantidades({
  cantidades,
  className = "",
}: {
  cantidades: CantidadesCiclo;
  /** Clases extra para acomodarlo donde se use (separación, tamaño…). */
  className?: string;
}) {
  const estados = ORDEN_CICLO.filter((estado) => cantidades[estado] > 0);
  if (!estados.length) return null;

  return (
    <div className={"text-xs font-normal text-tinta2 " + className}>
      {estados.map((estado, i) => (
        <span key={estado}>
          {i > 0 && " · "}
          <span className={colorDeCiclo(estado)}>
            {`${ETIQUETAS_CICLO[estado]}: ${numero(cantidades[estado])}`}
          </span>
        </span>
      ))}
    </div>
  );
}
