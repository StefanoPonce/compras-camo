"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { eliminarBorrador } from "../../actions";

/** Botón de "Borrar borrador". Solo aparece en los borradores, que son
 *  requisiciones a medio llenar: se pueden descartar sin dejar rastro, porque
 *  nunca entraron a revisión. Pide confirmación porque el formulario ya se
 *  vació al enviarlo. */
export default function BorrarBorrador({ id, folio }: { id: number; folio: string }) {
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  async function borrar() {
    const ok = window.confirm(
      `¿Borrar el borrador ${folio}?\n\nSe pierde todo lo que llevabas escrito en él. Si solo querías dejar de verlo más por ahora, ciérralo sin borrar.`
    );
    if (!ok) return;
    setOcupado(true);
    try {
      await eliminarBorrador(id);
      router.push("/ordenes");
      router.refresh();
    } catch {
      alert("No se pudo borrar el borrador. Intenta de nuevo.");
      setOcupado(false);
    }
  }

  return (
    <button onClick={borrar} disabled={ocupado} className="btn-peligro btn-chico">
      {ocupado ? "Borrando…" : "Borrar borrador"}
    </button>
  );
}