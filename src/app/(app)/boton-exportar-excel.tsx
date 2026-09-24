export default function BotonExportarExcel({
  href,
  texto = "Exportar a Excel",
}: {
  href: string;
  texto?: string;
}) {
  return (
    <a
      href={href}
      download
      className="btn-secundario no-imprimir whitespace-nowrap"
      aria-label="Descargar este listado en formato Excel"
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
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {texto}
    </a>
  );
}
