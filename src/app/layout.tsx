import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compras — Fundación CAMO",
  description: "Sistema de proceso de compras: proveedores, materiales, requisiciones y bitácora",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
