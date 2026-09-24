// Configuración de NextAuth: inicio de sesión con usuario y contraseña
// contra la tabla `usuarios`, y el rol viajando en la sesión.
import { randomBytes } from "node:crypto";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registrarMovimiento } from "@/lib/bitacora";
import { nombreRol, normalizarModulos, type Rol } from "@/lib/permisos";
import {
  ERROR_SESION_INVALIDA,
  ERROR_USUARIO_EN_USO,
  ERROR_USUARIO_INACTIVO,
} from "@/lib/auth-errors";

// La sesión se renueva con actividad. Si el usuario deja el dispositivo
// inactivo durante este tiempo, otro dispositivo puede iniciar sesión.
const DURACION_SESION_MS = 8 * 60 * 60 * 1000;
const RENOVAR_SESION_MS = 4 * 60 * 60 * 1000;

function nuevoTokenSesion() {
  return randomBytes(32).toString("hex");
}

function expiracionSesion(desde = new Date()) {
  return new Date(desde.getTime() + DURACION_SESION_MS);
}

function condicionSesionLibre(id: number, ahora: Date) {
  return {
    id,
    activo: true,
    OR: [
      { sesionToken: null },
      { sesionExpira: null },
      { sesionExpira: { lt: ahora } },
    ],
  };
}

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
        if (!encontrado) return null;
        if (!encontrado.activo) throw new Error(ERROR_USUARIO_INACTIVO);

        const ok = await bcrypt.compare(credentials.clave, encontrado.claveHash);
        if (!ok) return null;

        // El reclamo es condicional y atómico: si dos dispositivos intentan
        // entrar al mismo tiempo, solo uno puede tomar la sesión.
        const ahora = new Date();
        const sesionToken = nuevoTokenSesion();
        const reclamo = await prisma.usuario.updateMany({
          where: condicionSesionLibre(encontrado.id, ahora),
          data: {
            sesionToken,
            sesionExpira: expiracionSesion(ahora),
            ultimoIngreso: ahora,
          },
        });

        if (reclamo.count !== 1) {
          const estado = await prisma.usuario.findUnique({
            where: { id: encontrado.id },
            select: { activo: true },
          });
          throw new Error(estado?.activo ? ERROR_USUARIO_EN_USO : ERROR_USUARIO_INACTIVO);
        }

        try {
          await registrarMovimiento({
            usuarioId: encontrado.id,
            modulo: "Sesión",
            accion: "Inicio de sesión",
            detalle: `Entró al sistema como ${nombreRol(encontrado.rol)}`,
          });
        } catch (error) {
          // Si falla el registro de bitácora, no dejamos bloqueada la cuenta
          // con una sesión que el usuario nunca recibió.
          await prisma.usuario.updateMany({
            where: { id: encontrado.id, sesionToken },
            data: { sesionToken: null, sesionExpira: null },
          });
          throw error;
        }

        return {
          id: String(encontrado.id),
          name: encontrado.nombre,
          usuario: encontrado.usuario,
          rol: encontrado.rol,
          modulosPermitidos: normalizarModulos(encontrado.modulosPermitidos, encontrado.rol),
          sesionToken,
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
        token.modulosPermitidos = normalizarModulos(user.modulosPermitidos, user.rol);
        token.sesionToken = user.sesionToken;
        return token;
      }

      const id = Number(token.id);
      if (!Number.isInteger(id)) throw new Error(ERROR_SESION_INVALIDA);

      const ahora = new Date();
      const selectSesion = {
        id: true,
        usuario: true,
        rol: true,
        modulosPermitidos: true,
        activo: true,
        sesionToken: true,
        sesionExpira: true,
      };
      let actual = await prisma.usuario.findUnique({ where: { id }, select: selectSesion });

      // Si una seed recreó los usuarios y cambió el id, todavía podemos
      // recuperar la cuenta por su nombre de acceso.
      if (!actual && token.usuario) {
        actual = await prisma.usuario.findUnique({
          where: { usuario: String(token.usuario) },
          select: selectSesion,
        });
      }
      if (!actual || !actual.activo) throw new Error(ERROR_SESION_INVALIDA);

      // Los tokens que ya existían antes de esta función reciben su token
      // de sesión en la primera petición; no es necesario esperar al logout.
      let tokenSesion = token.sesionToken;
      if (!tokenSesion) {
        tokenSesion = nuevoTokenSesion();
        const reclamo = await prisma.usuario.updateMany({
          where: condicionSesionLibre(actual.id, ahora),
          data: { sesionToken: tokenSesion, sesionExpira: expiracionSesion(ahora) },
        });
        if (reclamo.count !== 1) throw new Error(ERROR_SESION_INVALIDA);
        token.sesionToken = tokenSesion;
      } else if (
        actual.sesionToken !== tokenSesion ||
        !actual.sesionExpira ||
        actual.sesionExpira <= ahora
      ) {
        throw new Error(ERROR_SESION_INVALIDA);
      }

      if (
        actual.sesionExpira &&
        actual.sesionExpira.getTime() - ahora.getTime() < RENOVAR_SESION_MS
      ) {
        await prisma.usuario.updateMany({
          where: { id: actual.id, sesionToken: tokenSesion },
          data: { sesionExpira: expiracionSesion(ahora) },
        });
      }

      token.id = String(actual.id);
      token.usuario = actual.usuario;
      token.rol = actual.rol;
      token.modulosPermitidos = normalizarModulos(actual.modulosPermitidos, actual.rol);
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        if (!token.id || !token.usuario || !token.rol || !token.sesionToken) {
          throw new Error(ERROR_SESION_INVALIDA);
        }
        session.user.id = String(token.id);
        session.user.usuario = String(token.usuario);
        session.user.rol = token.rol;
        session.user.modulosPermitidos = normalizarModulos(token.modulosPermitidos, token.rol);
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      const id = Number(token?.id);
      if (!Number.isInteger(id) || !token?.sesionToken) return;

      await prisma.usuario.updateMany({
        where: { id, sesionToken: token.sesionToken },
        data: { sesionToken: null, sesionExpira: null },
      });
    },
  },
};
