// La cookie de NextAuth identifica al usuario, pero el derecho a mantener esa
// identidad se renueva en la base de datos. Así, cuando el navegador desaparece
// sin poder avisar, la sesión tampoco bloquea un nuevo ingreso para siempre.
export const VIGENCIA_SESION_MS = 2 * 60 * 1000;

// Margen que se le da a la sesión cuando el navegador suelta la página
// (pagehide). No sirve para cerrar nada: solo acorta el vencimiento.
//
// Existe por un caso concreto: al RECARGAR, el navegador avisa que la página
// vieja se va antes de montar la nueva, así que el sistema no puede saber si
// el usuario cerró el navegador o solo pressed F5. Con este margen, la página
// que viene a cargar llega a tiempo y renueva la sesión con su latido, y la
// recarga no cierra sesión. Si de verdad se cerró el navegador, nadie renueva y
// la cuenta queda libre cuando el margen vence.
//
// Tiene que ser bastante más grande que INTERVALO_LATIDO_MS para que una
// pestaña que sigue abierta (aunque el navegador la ralentice por estar en
// segundo plano) alcance a renovar antes de que venza.
export const GRACIA_CIERRE_MS = 60 * 1000;

export function nuevaExpiracionSesion(desde = new Date()) {
  return new Date(desde.getTime() + VIGENCIA_SESION_MS);
}

// Vencimiento corto que se aplica al soltar la página, a la espera de que
// alguien lo renueve.
export function expiracionCierreSuave(desde = new Date()) {
  return new Date(desde.getTime() + GRACIA_CIERRE_MS);
}
