import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        fondo: "#EEF1EC",
        superficie: "#FFFFFF",
        superficie2: "#F7F9F6",
        tinta: "#17211E",
        tinta2: "#5A6661",
        borde: "#D3DACF",
        verde: "#12564A",
        verdeclaro: "#E2EDE9",
        ambar: "#8A6114",
        ambarclaro: "#F6EEDC",
        rojo: "#8C2F2A",
        rojoclaro: "#F6E6E4",
        azul: "#1F4E79",
        azulclaro: "#E4ECF4",
        // "En proceso de compra": el paso que sigue a Gestión. Va aparte del
        // ámbar (que es lo que todavía no se ha tocado) para que se distinga
        // de un vistazo en el detalle de la requisición.
        morado: "#5A3F8F",
        moradoclaro: "#ECE7F5",
      },
      fontFamily: {
        sora: ["Sora", "system-ui", "sans-serif"],
        plex: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
