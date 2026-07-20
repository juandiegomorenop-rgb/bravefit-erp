"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { duplicarCotizacion } from "../actions";

/**
 * Duplica la cotización como Borrador NUEVO (número nuevo, mismos
 * cliente/condiciones/ítems) y abre el editor. Disponible en cualquier
 * estado — es la vía para re-cotizar vencidas o hacer variantes.
 */
export function BotonDuplicar({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicar() {
    setError(null);
    setOcupado(true);
    const r = await duplicarCotizacion(id);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/ventas/cotizaciones/${r.id}/editar`);
  }

  return (
    <span className="flex items-center gap-2">
      {error && (
        <span className="text-[12px] font-semibold text-rojo">{error}</span>
      )}
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void duplicar()}
        title="Crea un borrador nuevo con los mismos ítems y abre el editor"
        className="rounded-pill border border-borde bg-card px-5 py-2.5 text-[13.5px] font-semibold hover:border-dorado disabled:opacity-50"
      >
        {ocupado ? "Duplicando…" : "⧉ Duplicar"}
      </button>
    </span>
  );
}
