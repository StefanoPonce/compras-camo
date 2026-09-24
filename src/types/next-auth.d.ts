// Le enseña a TypeScript que session.user trae usuario y rol, además
// de los campos normales de NextAuth.
import { DefaultSession } from "next-auth";
import type { Modulo, Rol } from "@/lib/permisos";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      usuario: string;
      rol: Rol;
      modulosPermitidos: Modulo[];
    } & DefaultSession["user"];
  }
  interface User {
    usuario: string;
    rol: Rol;
    modulosPermitidos: Modulo[];
    sesionToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    rol: Rol;
    modulosPermitidos?: string[];
    sesionToken?: string;
  }
}
