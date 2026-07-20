"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { anularOp } from "../actions";

/**
 * Anulación de la OP (solo Admin — la BD lo exige vía fn_anular_op):
 * motivo obligatorio; bloqueada si está entregada o tiene despachos.
 * Si ya descontó BOM, la BD reversa el inventario automáticamente.
 */
export function AnularOp({ opId, numero }: { opId: string; numero: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    if (!motivo.trim()) {
      setError("Escribe el motivo de la anulación.");
      return;
    }
    if (
      !window.confirm(
        `¿Anular la ${numero}? Sale del tablero de producción (queda en el Archivo) y, si ya descontó materia prima, el inventario se reversa. No se puede deshacer.`,
      )
    )
      return;
    setError(null);
    setOcupado(true);
    const r = await anularOp(opId, motivo);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push("/produccion/ordenes");
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-pill border border-rojo/40 bg-card px-4 py-2.5 text-[13px] font-semibold text-rojo hover:bg-rojo-bg"
      >
        ⛔ Anular O.P.
      </button>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1.5">
      <span className="flex items-center gap-2">
        <input
          autoFocus
          className="w-[260px] rounded-input border border-rojo/40 bg-card px-3 py-2 text-[13px] outline-none focus:border-rojo"
          placeholder="Motivo de la anulación *"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void confirmar()}
        />
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void confirmar()}
          className="rounded-pill bg-rojo px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {ocupado ? "Anulando…" : "Anular"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          className="rounded-pill px-3 py-2 text-[12.5px] font-semibold text-neutro hover:bg-neutro-bg"
        >
          Cancelar
        </button>
      </span>
      {error && (
        <span className="max-w-[420px] text-right text-[12px] font-semibold text-rojo">
          {error}
        </span>
      )}
    </span>
  );
}
