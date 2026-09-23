/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Límite del cuerpo de las server actions. Sube del 1 MB por
      // defecto para que entre la imagen del material en el formulario
      // (se comprime en el navegador, pero con margen de sobra).
      bodySizeLimit: "8mb",
    },
  },
};
export default nextConfig;
