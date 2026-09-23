# Compras — Fundación CAMO

Sistema de proceso de compras con cuatro roles (Administrador, Sub
Administrador, Jefe inmediato y Responsable de solicitar), catálogo de
proveedores y materiales, órdenes de compra, descargo de inventario y una
bitácora que registra todo lo que hace cada usuario. Hecho con **Next.js 14**,
**Prisma** y **PostgreSQL**.

## Roles y permisos

La matriz vive en un solo archivo: `src/lib/permisos.ts`. Todo el sistema
(menú, páginas y acciones del servidor) consulta esa matriz.

| # | Rol | Función |
|---|-----|---------|
| 1 | **Administrador** | Acceso total: da permisos, resetea contraseñas, crea usuarios, ve bitácora, reportes, proveedores, materiales, órdenes e inventario. |
| 2 | **Sub Administrador** | Genera reportes; realiza, modifica y autoriza órdenes; alimenta la base de datos (crea proveedores e insumos) y descarga inventario. |
| 3 | **Jefe inmediato** | Realiza, modifica y autoriza órdenes, y genera reportes. |
| 4 | **Responsable de solicitar** | Realiza requisiciones (órdenes de compra) y descarga inventario. |

## 1. Requisitos

- [Node.js](https://nodejs.org) versión 18 o superior
- [PostgreSQL](https://www.postgresql.org/download/) instalado y corriendo
  (localmente o en un servicio como Supabase)
- Visual Studio Code (o el editor que prefieras)

## 2. Abrir el proyecto

1. Descomprime `compras-camo.zip`.
2. Abre la carpeta `compras-camo` en Visual Studio Code (`Archivo → Abrir carpeta…`).
3. Abre una terminal integrada (`Terminal → Nueva terminal`).

## 3. Instalar las dependencias

```bash
npm install
```

## 4. Configurar la base de datos

1. Copia el archivo de ejemplo:

   ```bash
   cp .env.example .env
   ```

2. Abre `.env` y reemplaza `DATABASE_URL` con la conexión real a tu base
   PostgreSQL, por ejemplo:

   ```
   DATABASE_URL="postgresql://postgres:tu_clave@localhost:5432/compras_camo"
   ```

   Si vas a usar **Supabase**, copia la cadena de conexión desde
   *Project Settings → Database → Connection string* de tu proyecto.

3. Genera una clave para `NEXTAUTH_SECRET` y pégala en `.env`:

   ```bash
   openssl rand -base64 32
   ```

   (En Windows sin `openssl`, puedes usar cualquier cadena aleatoria larga,
   por ejemplo generada en https://generate-secret.vercel.app/32.)

4. Crea las tablas en la base de datos a partir del esquema de Prisma:

   ```bash
   npx prisma migrate dev --name inicial
   ```

5. Carga los datos de prueba (usuarios, proveedores y materiales de ejemplo):

   ```bash
   npm run prisma:seed
   ```

## 5. Ejecutar el proyecto

```bash
npm run dev
```

Abre http://localhost:3000 en el navegador. Verás la pantalla de inicio de
sesión.

**Cuentas de prueba** (creadas por el seed):

| Cuenta     | Contraseña   | Rol                     |
|------------|--------------|-------------------------|
| `admin`    | `admin123`   | Administrador           |
| `subadmin` | `compras123` | Sub Administrador       |
| `jefe`     | `compras123` | Jefe inmediato          |
| `compras`  | `compras123` | Responsable de solicitar|

Cambia estas contraseñas antes de entregar el sistema a la fundación,
desde la sección **Usuarios** (solo visible para el administrador).

## 6. Estructura del proyecto

```
compras-camo/
├─ prisma/
│  ├─ schema.prisma      → definición de las tablas (usuarios, proveedores,
│  │                        materiales, órdenes, descargos, bitácora)
│  ├─ migracion-roles.sql→ SQL que migró el enum de roles al catálogo actual
│  └─ seed.ts            → datos de prueba
├─ src/
│  ├─ lib/
│  │  ├─ prisma.ts       → conexión a la base de datos
│  │  ├─ auth.ts         → configuración del inicio de sesión (NextAuth)
│  │  ├─ permisos.ts     → matriz de permisos por rol (el centro de todo)
│  │  ├─ imagenes.ts     → subida/borrado de fotos en Supabase Storage
│  │  └─ bitacora.ts     → función para registrar cada movimiento
│  ├─ middleware.ts      → exige sesión para entrar a la aplicación
│  └─ app/
│     ├─ login/          → pantalla de inicio de sesión
│     └─ (app)/          → todo lo que requiere sesión iniciada
│        ├─ actions.ts   → toda la lógica: crear, aprobar, rechazar, recibir…
│        ├─ imagen-material.tsx → miniatura compartida de productos
│        ├─ imagenes-cliente.ts → compresión de fotos en el navegador
│        ├─ page.tsx     → panel principal
│        ├─ proveedores/
│        ├─ materiales/
│        ├─ ordenes/
│        ├─ inventario/  → descargo de inventario (salida de bodega)
│        ├─ reportes/    → reportes de gestión y de insumos
│        ├─ bitacora/    → solo administrador
│        └─ usuarios/    → solo administrador
└─ .env.example
```

## 7. Imágenes de los materiales

Las fotos de los productos se guardan en **Supabase Storage** (bucket
público `materiales`, que la app crea sola la primera vez):

- En **Materiales → + Nuevo material** hay un campo *Imagen del producto*
  con vista previa (también al editar un material, donde se puede
  reemplazar o quitar).
- Las imágenes se reducen automáticamente a 1200 px en el navegador
  antes de subirse, para no pesar de más.
- En **Órdenes**, la foto del producto se muestra en cada renglón al
  momento de pedirlo y en el detalle de la orden creada.

Para que funcione, `.env` debe traer estas dos claves (consola de
Supabase → *Project Settings → API*):

```
SUPABASE_URL="https://xxxxxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
```

Si faltan, el formulario avisa y el resto del sistema sigue funcionando.

## 8. Ver la base de datos visualmente

Prisma trae su propio panel para ver y editar filas sin escribir SQL:

```bash
npm run prisma:studio
```

## 9. Publicar el sistema para que la fundación lo use

Cuando esté listo:

1. Sube el código a un repositorio (por ejemplo GitHub).
2. Despliega en [Vercel](https://vercel.com) (gratis para este tamaño de
   proyecto) conectando el repositorio.
3. En Vercel, agrega las mismas variables de `.env` en
   *Settings → Environment Variables*.
4. Usa una base PostgreSQL que la fundación controle (una cuenta de
   Supabase creada con el correo institucional, o un servidor propio),
   no tu cuenta personal — así los datos se quedan con ellos.
5. Corre `npx prisma migrate deploy` contra esa base de producción para
   crear las tablas, y `npm run prisma:seed` una sola vez si quieres
   dejar los datos de ejemplo (o créalos manualmente desde la app).

## 10. Respaldos

Con acceso a la base, un respaldo completo se hace con:

```bash
pg_dump "postgresql://usuario:clave@host:5432/compras_camo" > respaldo.sql
```

Guárdalo en un lugar seguro (Google Drive de la fundación, por ejemplo)
cada semana.
