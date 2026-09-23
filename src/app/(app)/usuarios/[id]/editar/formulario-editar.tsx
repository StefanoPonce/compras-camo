"use client";
import { useFormState, useFormStatus } from "react-dom";
import { editarUsuario } from "../../../actions";
import { ROLES, type Rol } from "@/lib/permisos";

type Usuario = { id: number; nombre: string; usuario: string; rol: Rol };

function BotonGuardar() {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>;
}

export default function FormularioEditarUsuario({ u }: { u: Usuario }) {
  const accion = editarUsuario.bind(null, u.id);
  const [estado, ejecutar] = useFormState(accion, { error: null });

  return (
    <form action={ejecutar} className="tarjeta p-5 grid gap-3.5">
      {estado.error && <div className="bg-rojoclaro text-rojo text-sm px-3 py-2 rounded-lg">{estado.error}</div>}
      <input className="campo-input" name="nombre" defaultValue={u.nombre} required />
      <input className="campo-input bg-superficie2" value={u.usuario} disabled />
      <select className="campo-input" name="rol" defaultValue={u.rol}>
        {ROLES.map((r) => (
          <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
        ))}
      </select>
      <input className="campo-input" name="clave" placeholder="Nueva contraseña (opcional)" />
      <div className="flex gap-2 justify-end">
        <a href="/usuarios" className="btn-secundario">Cancelar</a>
        <BotonGuardar />
      </div>
    </form>
  );
}
