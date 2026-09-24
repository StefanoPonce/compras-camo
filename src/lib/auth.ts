// Configuración de NextAuth: inicio de sesión con usuario y contraseña
// contra la tabla `usuarios`, y el rol viajando en la sesión.
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registrarMovimiento } from "@/lib/bitacora";
import { nombreRol, normalizarModulos, type Rol } from "@/lib/permisos";

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
          detalle: `Entró al sistema como ${nombreRol(encontrado.rol)}`,
        });

        return {
          id: String(encontrado.id),
          name: encontrado.nombre,
          usuario: encontrado.usuario,
          rol: encontrado.rol,
          modulosPermitidos: normalizarModulos(encontrado.modulosPermitidos, encontrado.rol),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.usuario = user.usuario;
        token.rol = user.rol;
        token.modulosPermitidos = user.modulosPermitidos;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // La seed con --limpiar borra y vuelve a crear los usuarios, lo que
        // les asigna ids nuevos y deja el JWT con un id viejo. Ese id obsoleto
        // rompe después las llaves foráneas (descargos, solicitante de la
        // orden…), así que aquí se revalida contra la base: primero por id y,
        // si ya no existe, por nombre de cuenta para retomar el id actual.
        let id = String(token.id ?? "");
        let rol = token.rol as Rol;
        let modulosPermitidos = normalizarModulos(token.modulosPermitidos, rol);

        const porId = Number.isInteger(Number(id))
          ? await prisma.usuario.findUnique({
              where: { id: Number(id) },
              select: { id: true, rol: true, modulosPermitidos: true },
            })
          : null;

        if (porId) {
          id = String(porId.id);
          rol = porId.rol;
          modulosPermitidos = normalizarModulos(porId.modulosPermitidos, rol);
        } else if (token.usuario) {
          const porCuenta = await prisma.usuario.findUnique({
            where: { usuario: String(token.usuario) },
            select: { id: true, rol: true, modulosPermitidos: true },
          });
          if (porCuenta) {
            id = String(porCuenta.id);
            rol = porCuenta.rol;
            modulosPermitidos = normalizarModulos(porCuenta.modulosPermitidos, rol);
          }
        }

        session.user.id = id;
        session.user.usuario = token.usuario as string;
        session.user.rol = rol;
        session.user.modulosPermitidos = modulosPermitidos;
      }
      return session;
    },
  },
};
