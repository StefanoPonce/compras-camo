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
