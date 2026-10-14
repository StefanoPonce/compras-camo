// Catálogo de programas de la Fundación CAMO.
//
// Este archivo es la única fuente de verdad: el formulario de requisición arma
// su lista desplegable desde aquí y las pantallas que muestran una requisición
// (listado, detalle e impresión) usan nombrePrograma() para traducir el código
// guardado ("2.2") al texto con su nombre ("2.2 Laboratorio de Silla de Ruedas").
//
// En la base de datos, ordenes_compra.programa guarda SOLO el código, para que
// los reportes puedan agrupar por número sin depender del texto.

export type Programa = {
  /** Código corto con el que se guarda en la base: "2.2" */
  codigo: string;
  /** Nombre del programa, como se muestra en el formulario. */
  nombre: string;
};

export type GrupoProgramas = {
  /** Encabezado del grupo en el formulario. */
  grupo: string;
  programas: Programa[];
};

export const PROGRAMAS: GrupoProgramas[] = [
  {
    grupo: "1 - Programa de Atención a la Mujer",
    programas: [
      { codigo: "1.1", nombre: "Prevención de Cáncer Cervicouterino VF" },
      { codigo: "1.2", nombre: "Ginecología" },
      { codigo: "1.3", nombre: "Mamografía VF" },
      { codigo: "1.4", nombre: "Mamografía Corquín" },
      { codigo: "1.5", nombre: "Ultrasonido VF" },
      { codigo: "1.6", nombre: "Ultrasonido Corquín" },
    ],
  },
  {
    grupo: "2 - Programa para personas con Discapacidad",
    programas: [
      { codigo: "2.1", nombre: "Laboratorio de Órtesis y Protésis" },
      { codigo: "2.2", nombre: "Laboratorio de Silla de Ruedas" },
    ],
  },
  {
    grupo: "3 - Programa de Servicios de Cirugía",
    programas: [
      { codigo: "3.1", nombre: "Neurocirugía" },
      { codigo: "3.1.1", nombre: "Neurocirugía FD" },
      { codigo: "3.2", nombre: "Oftalmología" },
    ],
  },
  {
    grupo: "4 - Programa de Servicios Médicos",
    programas: [
      { codigo: "4.1.1", nombre: "Cardiología" },
      { codigo: "4.1.2", nombre: "Cuidado de Pie Diabético" },
      { codigo: "4.2.3", nombre: "Dermatología" },
      { codigo: "4.2.4", nombre: "Gastroenterología" },
      { codigo: "4.2.5", nombre: "Medicina General" },
      { codigo: "4.2.6", nombre: "Medicina Interna" },
      { codigo: "4.2.7", nombre: "Neurología" },
      { codigo: "4.2.8", nombre: "Nutrición" },
      { codigo: "4.2.9", nombre: "Psicología" },
      { codigo: "4.2.10", nombre: "Rayos X VF" },
      { codigo: "4.2.11", nombre: "Rayos X Corquín" },
    ],
  },
  {
    grupo: "4-2 Servicio Odontológico",
    programas: [
      { codigo: "4-2.1", nombre: "Clínica Dental" },
      { codigo: "4-2.2", nombre: "Brigada Dental" },
      { codigo: "4-3.3", nombre: "Maxilofacial" },
    ],
  },
  {
    grupo: "5 - Programa Servicios de Apoyo",
    programas: [
      { codigo: "5.1", nombre: "Brigada USA" },
      { codigo: "5.2", nombre: "Brigadas Médicas" },
      { codigo: "5.3", nombre: "Servicios Sociales" },
      { codigo: "5.3.1", nombre: "Servicios Sociales FD" },
    ],
  },
  {
    grupo: "6 - Educación",
    programas: [
      { codigo: "6.1", nombre: "Centro de Cuidados Infantiles" },
      { codigo: "6.2", nombre: "Lactancia Materna" },
      { codigo: "6.3", nombre: "Literatura (PESI)" },
      { codigo: "6.4", nombre: "Protocolos de Enfermería" },
      { codigo: "6.5", nombre: "Reanimación Cardiopulmonar" },
    ],
  },
  {
    grupo: "7 - Desarrollo Comunitario",
    programas: [
      { codigo: "7.1", nombre: "CAMO SUR" },
      { codigo: "7.2", nombre: "CAMO Yoro" },
      { codigo: "7.3", nombre: "FAKS" },
      { codigo: "7.4", nombre: "Fundación Casa Hogar" },
      { codigo: "7.5", nombre: "Team Up" },
      { codigo: "7.6", nombre: "ETAOO" },
    ],
  },
  {
    grupo: "8 - Gestión de Recursos y Actividades",
    programas: [
      { codigo: "8.1", nombre: "CAMO RUN" },
      { codigo: "8.2", nombre: "Gestión de Recursos" },
      { codigo: "8.3", nombre: "Ruta Copán" },
      { codigo: "8.4", nombre: "CAMO Colecta" },
      { codigo: "8.5", nombre: "Concierto" },
      { codigo: "8.6", nombre: "Conferencia" },
      { codigo: "8.7", nombre: "Rifas Benéficas" },
    ],
  },
  {
    grupo: "9 - Unidad de Soporte",
    programas: [
      { codigo: "9.1", nombre: "Operaciones" },
      { codigo: "9.2", nombre: "Unidades Ejecutivas y Administrativas" },
      { codigo: "9.3", nombre: "Plan Estratégico" },
      { codigo: "9.4", nombre: "Biomédica" },
      { codigo: "9.5", nombre: "Talento Humano" },
    ],
  },
  {
    grupo: "10 - Unidad de Mercadeo",
    programas: [
      { codigo: "10.1", nombre: "Mercadeo HN" },
      { codigo: "10.2", nombre: "Mercadeo USA" },
    ],
  },
  {
    grupo: "11 - Proyecto Expansión",
    programas: [{ codigo: "11", nombre: "Proyecto Expansión" }],
  },
];

// Mapa código → nombre, para buscar en O(1) en las pantallas.
const POR_CODIGO = new Map<string, string>(
  PROGRAMAS.flatMap((g) => g.programas.map((p) => [p.codigo, p.nombre] as const))
);

/** Texto completo del programa a partir de su código: "2.2" → "2.2 Laboratorio de Silla de Ruedas". */
export function textoPrograma(codigo: string | null | undefined): string {
  if (!codigo) return "";
  const nombre = POR_CODIGO.get(codigo);
  return nombre ? `${codigo} ${nombre}` : codigo;
}
