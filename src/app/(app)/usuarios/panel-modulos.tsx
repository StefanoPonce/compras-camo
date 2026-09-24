"use client";

import { MODULOS, MODULOS_POR_ROL, type Modulo, type Rol } from "@/lib/permisos";

type Props = {
  rol: Rol;
  seleccionados: Modulo[];
  onToggle: (modulo: Modulo) => void;
};

export default function PanelModulos({ rol, seleccionados, onToggle }: Props) {
  const esAdministrador = rol === "administrador";
  const disponibles = MODULOS_POR_ROL[rol];

  return (
    <fieldset className="sm:col-span-2 border border-borde rounded-lg p-3.5 bg-superficie2">
      <legend className="px-1 font-medium text-sm">Módulos que podrá ver</legend>
      <p className="text-xs text-tinta2 mt-1 mb-3">
        Marca los módulos disponibles para este usuario. Por seguridad, el panel solo permite quitar módulos del alcance del rol; las acciones internas seguirán respetando ese rol.
      </p>
      {esAdministrador && (
        <div className="rounded-lg bg-azulclaro text-azul px-3 py-2 text-xs mb-3">
          El administrador siempre conserva el acceso a todos los módulos para poder administrar los demás usuarios.
        </div>
      )}
      <input type="hidden" name="modulos" value="panel" />
      <div className="grid sm:grid-cols-2 gap-2">
        {MODULOS.filter((modulo) => disponibles.includes(modulo.valor)).map((modulo) => {
          const bloqueado = esAdministrador || modulo.valor === "panel";
          return (
            <label
              key={modulo.valor}
              className="flex items-start gap-2.5 rounded-lg border border-borde bg-superficie px-3 py-2.5 cursor-pointer"
            >
              <input
                type="checkbox"
                name={bloqueado ? undefined : "modulos"}
                value={modulo.valor}
                checked={seleccionados.includes(modulo.valor)}
                disabled={bloqueado}
                onChange={() => onToggle(modulo.valor)}
                className="mt-0.5 accent-verde"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{modulo.etiqueta}</span>
                <span className="block text-xs text-tinta2 mt-0.5">{modulo.descripcion}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
