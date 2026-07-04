"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError("Correo o contraseña incorrectos.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Verifica la configuración de Supabase.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo px-4">
      <div className="w-full max-w-[400px] rounded-card border border-borde bg-card px-8 py-10">
        <div className="flex justify-center">
          <Image
            src="/brand/logo-carbon.png"
            alt="BRAVEFIT"
            width={160}
            height={34}
            priority
            className="h-8 w-auto"
          />
        </div>
        <p className="mt-3 text-center text-[13px] text-neutro">
          ERP interno · acceso solo para el equipo
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[.4px] text-[#8a8a8a]"
            >
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@bravefit.co"
              className="w-full rounded-input border border-gris-claro bg-white px-3 py-2.5 text-[14px] text-carbon outline-none placeholder:text-[#b5b5b3] focus:border-dorado"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-[11.5px] font-semibold uppercase tracking-[.4px] text-[#8a8a8a]"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-input border border-gris-claro bg-white px-3 py-2.5 text-[14px] text-carbon outline-none placeholder:text-[#b5b5b3] focus:border-dorado"
            />
          </div>

          {error && (
            <p className="rounded-[10px] bg-rojo-bg px-3 py-2 text-[13px] font-medium text-rojo">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-pill bg-carbon py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-black disabled:opacity-60"
          >
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
