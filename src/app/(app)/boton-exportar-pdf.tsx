export default function BotonExportarPdf({
  href,
  texto = "Exportar a PDF",
}: {
  href: string;
  texto?: string;
}) {
  // A diferencia del botón de imprimir (que depende del diálogo del navegador),
  // este descarga el PDF ya armado en el servidor.
  return (
    <a
      href={href}
      download
      className="btn-secundario no-imprimir whitespace-nowrap"
      aria-label="Descargar este listado en formato PDF"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M12 12v6" />
        <path d="m9 15 3 3 3-3" />
      </svg>
      {texto}
    </a>
  );
}
