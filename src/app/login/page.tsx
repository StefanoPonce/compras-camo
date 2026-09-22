"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function PaginaIngreso() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const res = await signIn("credentials", { usuario, clave, redirect: false });
    setEnviando(false);
    if (res?.error) {
      setError("Usuario o contraseña incorrectos. Verifica y vuelve a intentar.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-verde text-white p-20">
        <span className="text-sm tracking-wide opacity-80">Fundación CAMO</span>
        <div>
          <h1 className="font-sora text-4xl leading-tight max-w-[11ch]">Proceso de compras</h1>
          <p className="max-w-[38ch] opacity-85 mt-4">
            Registro de proveedores, materiales y órdenes de compra, con bitácora de todo lo que hace cada usuario.
          </p>
        </div>
        <span className="text-sm opacity-80">Santa Rosa de Copán, Honduras</span>
      </div>

     
    

      <div className="flex items-center justify-center p-8">
  <form onSubmit={entrar} className="w-full max-w-sm">

    {/* LOGO DE CAMO */}
    <div className="flex justify-center mb-6">
      <Image
        src="/logo-camo.png"
        alt="Logo Fundación CAMO"
        width={300}
        height={300}
        className="object-contain"
      />
    </div>

    <h2 className="font-sora text-xl mb-9">
      Inicio sesión
    </h2>

    {error && (
      <div className="bg-rojoclaro text-rojo text-sm px-3 py-2.5 rounded-lg mb-4">
        {error}
      </div>
    )}
          <div className="mb-4">
            <label className="block text-sm text-tinta2 mb-1.5 font-medium" htmlFor="usuario">Usuario</label>
            <input id="usuario" className="campo-input" autoCapitalize="none" value={usuario}
              onChange={(e) => setUsuario(e.target.value)} />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-tinta2 mb-1.5 font-medium" htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" className="campo-input" value={clave}
              onChange={(e) => setClave(e.target.value)} />
          </div>

          <button className="btn w-full" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>

          <div className="bg-superficie2 border border-borde rounded-lg p-3 text-xs text-tinta2 mt-6">
            Credenciales de prueba<br />
            Administrador: <span className="font-mono">admin</span> / <span className="font-mono">admin123</span><br />
            Usuario: <span className="font-mono">compras</span> / <span className="font-mono">compras123</span>
          </div>
        </form>
      </div>
    </div>
  );
}
