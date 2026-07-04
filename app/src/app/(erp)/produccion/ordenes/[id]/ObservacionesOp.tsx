"use client";

import { useState } from "react";
import { getOpsRepository } from "@/lib/data/ops";
import { formatFechaHora } from "@/lib/formato";
import type { OpObservacion } from "@/lib/types/db";

/**
 * Observaciones de la O.P. con formulario (isla cliente, optimista):
 * agrega vía el data layer y refleja en estado local.
 */
export function ObservacionesOp({
  opId,
  iniciales,
}: {
  opId: string;
  iniciales: OpObservacion[];
}) {
  const [lista, setLista] = useState<OpObservacion[]>(iniciales);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      const obs = await getOpsRepository().agregarObservacion(opId, limpio);
      setLista((prev) => [obs, ...prev]);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-card border border-borde bg-card px-5 py-4">
      <h2 className="text-[14px] font-bold">
        Observaciones{" "}
        <span className="font-normal text-neutro">({lista.length})</span>
      </h2>

      <form onSubmit={enviar} className="no-print mt-3 flex flex-col gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Agregar una observación…"
          className="w-full resize-y rounded-input border border-borde bg-sutil px-3 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="self-end rounded-pill bg-carbon px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? "Guardando…" : "Agregar observación"}
        </button>
      </form>

      <div className="mt-2 flex flex-col">
        {lista.length === 0 && (
          <p className="py-2 text-[13px] text-neutro">Sin observaciones.</p>
        )}
        {lista.map((o) => (
          <div
            key={o.id}
            className="border-b border-[#f6f5f2] py-2.5 last:border-b-0"
          >
            <div className="flex items-center gap-2 text-[11.5px] text-neutro">
              <span
                className={`rounded-pill px-2 py-0.5 font-bold ${
                  o.via === "chat"
                    ? "bg-azul-bg text-azul"
                    : "bg-neutro-bg text-neutro"
                }`}
              >
                {o.via === "chat" ? "Chat Claude" : "App"}
              </span>
              {formatFechaHora(new Date(o.en))}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed">{o.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
