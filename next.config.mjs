/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Límite del cuerpo de las server actions. Da margen para la foto del
      // catálogo, la de cada material y los adjuntos (PDF) de los renglones:
      // aunque cada archivo tope los 8 MB, en una requisición pueden ir varios
      // a la vez y todos viajan en el mismo envío.
      bodySizeLimit: "25mb",
    },
  },
};
export default nextConfig;
