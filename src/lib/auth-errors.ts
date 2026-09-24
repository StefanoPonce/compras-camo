// Códigos internos que NextAuth devuelve al formulario de acceso. Se
// mantienen aquí, sin importar Prisma, para que el cliente pueda mostrar un
// mensaje concreto sin exponer detalles de la base de datos.
export const ERROR_USUARIO_INACTIVO = "USUARIO_INACTIVO";
export const ERROR_USUARIO_EN_USO = "USUARIO_EN_USO";
export const ERROR_SESION_INVALIDA = "SESION_INVALIDA";

export const MENSAJES_AUTENTICACION: Record<string, string> = {
  [ERROR_USUARIO_INACTIVO]:
    "Tu perfil fue desactivado. Contacta al administrador del sistema para solicitar el acceso.",
  [ERROR_USUARIO_EN_USO]:
    "Este usuario ya tiene una sesión activa en otro dispositivo. Cierra sesión en el otro dispositivo e intenta nuevamente.",
  [ERROR_SESION_INVALIDA]:
    "Tu sesión ya no está activa. Inicia sesión nuevamente.",
};
