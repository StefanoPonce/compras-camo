// Le enseña a TypeScript que session.user trae usuario, rol y área (gerencia),
// además de los campos normales de NextAuth.
import { DefaultSession } from "next-auth";
import type { Modulo, Rol } from "@/lib/permisos";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      usuario: string;
      rol: Rol;
      /** Gerencia asignada al usuario (valor de src/lib/dependencias.ts).
       *  null cuando el administrador no le ha puesto un área todavía. */
      area: string | null;
      modulosPermitidos: Modulo[];
    } & DefaultSession["user"];
  }
  interface User {
    usuario: string;
    rol: Rol;
    area: string | null;
    modulosPermitidos: Modulo[];
    sesionToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    rol: Rol;
    area?: string | null;
    modulosPermitidos?: string[];
    sesionToken?: string;
  }
}
