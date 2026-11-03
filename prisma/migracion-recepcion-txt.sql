-- Agrega la columna donde el sub administrador escribe quién recibió la entrega
-- de una requisición. Ejecutar con:
--   npx prisma db execute --file prisma/migracion-recepcion-txt.sql --schema prisma/schema.prisma
--
-- Antes, "Entregado por" tomaba el nombre de la cuenta que marcaba la
-- requisición como recibida. Ahora solo el sub administrador registra la
-- entrega y escribe el nombre de quien la recibe (que no siempre tiene
-- cuenta en el sistema), así que se guarda ese texto aparte.
--
-- Solo agrega la columna: no toca datos existentes. IF NOT EXISTS hace que
-- repetir el archivo no cause error.

ALTER TABLE "ordenes_compra" ADD COLUMN IF NOT EXISTS "recibidoPorTxt" TEXT;
