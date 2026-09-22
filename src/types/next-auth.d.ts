// Le enseña a TypeScript que session.user trae usuario y rol, además
// de los campos normales de NextAuth.
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      usuario: string;
      rol: "usuario" | "administrador";
    } & DefaultSession["user"];
  }
  interface User {
    usuario: string;
    rol: "usuario" | "administrador";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    usuario: string;
    rol: "usuario" | "administrador";
  }
}
