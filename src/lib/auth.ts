// Configuración de NextAuth: inicio de sesión con usuario y contraseña
// contra la tabla `usuarios`, y el rol viajando en la sesión.
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registrarMovimiento } from "@/lib/bitacora";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        usuario: { label: "Usuario", type: "text" },
        clave: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.usuario || !credentials?.clave) return null;

        const encontrado = await prisma.usuario.findUnique({
          where: { usuario: credentials.usuario.trim().toLowerCase() },
        });
        if (!encontrado || !encontrado.activo) return null;

        const ok = await bcrypt.compare(credentials.clave, encontrado.claveHash);
        if (!ok) return null;

        await prisma.usuario.update({
          where: { id: encontrado.id },
          data: { ultimoIngreso: new Date() },
        });
        await registrarMovimiento({
          usuarioId: encontrado.id,
          modulo: "Sesión",
          accion: "Inicio de sesión",
          detalle: `Entró al sistema como ${encontrado.rol}`,
        });

        return {
          id: String(encontrado.id),
          name: encontrado.nombre,
          usuario: encontrado.usuario,
          rol: encontrado.rol,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error -- campos propios añadidos en authorize()
        token.usuario = user.usuario;
        // @ts-expect-error
        token.rol = user.rol;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.usuario = token.usuario as string;
        session.user.rol = token.rol as "usuario" | "administrador";
      }
      return session;
    },
  },
};
