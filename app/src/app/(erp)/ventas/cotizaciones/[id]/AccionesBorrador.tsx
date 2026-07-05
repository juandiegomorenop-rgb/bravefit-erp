"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enviarCotizacion } from "../actions";

/** Acciones disponibles solo mientras la cotización es BORRADOR. */
export function AccionesBorrador({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError(null);
    setEnviando(true);
    const r = await enviarCotizacion(id);
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2.5">
      {error && <span className="text-[12px] font-semibold text-rojo">{error}</span>}
      <Link
        href={`/ventas/cotizaciones/${id}/editar`}
        className="rounded-pill border border-borde bg-card px-5 py-2.5 text-[13.5px] font-semibold hover:border-dorado"
      >
        ✎ Editar
      </Link>
      <button
        type="button"
        disabled={enviando}
        onClick={() => void enviar()}
        className="rounded-pill bg-verde px-5 py-2.5 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Marcar Enviada"}
      </button>
    </span>
  );
}
