// ¿Responden los chunks de /ordenes/nueva y traen la action?
import { readFileSync } from "node:fs";

const ORIGEN = "http://localhost:3100";
const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

async function main() {
  for (const linea of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }

  const csrfRes = await fetch(`${ORIGEN}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const entra = await fetch(`${ORIGEN}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieDe(csrfRes) },
    body: new URLSearchParams({ csrfToken, usuario: "admin", clave: "admin123", json: "true" }),
  });
  const sesion = [cookieDe(csrfRes), cookieDe(entra)].filter(Boolean).join("; ");

  const urls = [
    "/_next/static/chunks/app/(app)/layout.js",
    "/_next/static/chunks/app/(app)/ordenes/nueva/page.js",
  ];
  for (const u of urls) {
    const r = await fetch(ORIGEN + u, { headers: { Cookie: sesion } });
    const js = await r.text();
    console.log(`${u}\n   HTTP ${r.status} · ${js.length} bytes · contiene crearOrden: ${js.includes("crearOrden")}`);
    if (r.status === 200) {
      const h = js.match(/var crearOrden\s*=[^"]*"([0-9a-f]{16,})"/);
      console.log(`   regex: ${h ? h[1].slice(0, 12) : "sin coincidencia"}`);
    } else {
      console.log(`   cuerpo: ${js.slice(0, 160).replace(/\s+/g, " ")}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
