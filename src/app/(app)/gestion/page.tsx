import VistaConsolidacion from "./vista-consolidacion";

/** Módulo Gestión: al entrar se ve la consolidación de compras de una vez,
 *  sin páginas intermedias ni botones de "abrir" la función. */
export default async function Gestion({
  searchParams,
}: {
  searchParams: { estado?: string; q?: string };
}) {
  return <VistaConsolidacion searchParams={searchParams} />;
}
