"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { anularCotizacion, enviarCotizacion } from "../actions";

/**
 * Acciones según el estado:
 *   · Borrador → Editar + Marcar Enviada + Anular
 *   · Enviada/Vencida → Anular
 *   · Aprobada/Anulada → nada (terminales; la Aprobada ya generó OP)
 * Anular manda la oportunidad viva del embudo a Perdido y la
 * cotización se va al Archivo del listado.
 */
export function AccionesCotizacion({
  id,
  numero,
  estadoNombre,
}: {
  id: string;
  numero: string;
  estadoNombre: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const esBorrador = estadoNombre === "Borrador";

  async function enviar() {
    setError(null);
    setOcupado(true);
    const r = await enviarCotizacion(id);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  async function anular() {
    if (
      !window.confirm(
        `¿Anular la ${numero}? Si está en el embudo CRM, la oportunidad pasa a Perdido y la cotización se va al Archivo. No se puede deshacer.`,
      )
    )
      return;
    setError(null);
    setOcupado(true);
    const r = await anularCotizacion(id);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2.5">
      {error && (
        <span className="text-[12px] font-semibold text-rojo">{error}</span>
      )}
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void anular()}
        className="rounded-pill border border-rojo/40 bg-card px-4 py-2.5 text-[13px] font-semibold text-rojo hover:bg-rojo-bg disabled:opacity-50"
      >
        Anular
      </button>
      {esBorrador && (
        <>
          <Link
            href={`/ventas/cotizaciones/${id}/editar`}
            className="rounded-pill border border-borde bg-card px-5 py-2.5 text-[13.5px] font-semibold hover:border-dorado"
          >
            ✎ Editar
          </Link>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void enviar()}
            className="rounded-pill bg-verde px-5 py-2.5 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {ocupado ? "Un momento…" : "Marcar Enviada"}
          </button>
        </>
      )}
    </span>
  );
}
