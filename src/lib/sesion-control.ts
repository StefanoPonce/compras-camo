// La cookie de NextAuth identifica al usuario, pero el derecho a mantener esa
// identidad se renueva en la base de datos. Así, cuando el navegador desaparece
// sin poder avisar, la sesión tampoco bloquea un nuevo ingreso para siempre.
export const VIGENCIA_SESION_MS = 2 * 60 * 1000;

export function nuevaExpiracionSesion(desde = new Date()) {
  return new Date(desde.getTime() + VIGENCIA_SESION_MS);
}
