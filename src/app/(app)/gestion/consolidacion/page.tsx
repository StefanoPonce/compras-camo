import { redirect } from "next/navigation";

/** La consolidación ahora vive directamente en /gestion. Esta ruta se conserva
 *  para que los enlaces y marcadores viejos sigan llevando a los datos. */
export default async function Consolidacion({
  searchParams,
}: {
  searchParams: { estado?: string; q?: string };
}) {
  const params = new URLSearchParams();
  if (searchParams.estado) params.set("estado", searchParams.estado);
  if (searchParams.q) params.set("q", searchParams.q);
  const destino = params.toString() ? `/gestion?${params.toString()}` : "/gestion";
  redirect(destino);
}
