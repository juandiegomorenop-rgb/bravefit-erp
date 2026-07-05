"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Garantia, Usuario } from "@/lib/types/db";
import { actualizarGarantia } from "../actions";
import { RECOGIDA_LABEL } from "../GarantiasClient";

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

/** Isla cliente: gestión de recogida, vendedor, costo y detalle. */
export function EditarGarantia({
  garantia: g,
  usuarios,
}: {
  garantia: Garantia;
  usuarios: Usuario[];
}) {
  const router = useRouter();
  const [recogida, setRecogida] = useState(g.recogida);
  const [vendedorId, setVendedorId] = useState(g.vendedor_id ?? "");
  const [costo, setCosto] = useState(g.costo_resolucion ?? 0);
  const [detalle, setDetalle] = useState(g.detalle ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function guardar() {
    setError(null);
    setOk(false);
    setGuardando(true);
    const r = await actualizarGarantia(g.id, {
      recogida,
      vendedor_id: vendedorId || null,
      costo_resolucion: costo || null,
      detalle: detalle.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-borde bg-card p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
        Gestión
      </p>
      {error && (
        <p className="mt-2 text-[12.5px] font-semibold text-rojo">{error}</p>
      )}
      {ok && (
        <p className="mt-2 text-[12.5px] font-semibold text-verde">
          Cambios guardados ✓
        </p>
      )}
      <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          RECOGIDA DE LA PIEZA
          <div className="flex gap-1.5">
            {(Object.keys(RECOGIDA_LABEL) as Garantia["recogida"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setRecogida(k)}
                className={`flex-1 rounded-input border px-2 py-2 text-[11px] font-bold ${
                  recogida === k
                    ? "border-carbon bg-carbon text-white"
                    : "border-borde bg-card text-neutro hover:border-dorado"
                }`}
              >
                {RECOGIDA_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          VENDEDOR (consultas del cliente)
          <select
            className={inputCls}
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
          >
            <option value="">Por asignar…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          COSTO DE RESOLUCIÓN (COP)
          <input
            type="number"
            min={0}
            className={inputCls}
            value={costo || ""}
            onChange={(e) => setCosto(Number(e.target.value) || 0)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro sm:col-span-2">
          DETALLE / BITÁCORA
          <textarea
            rows={3}
            className={inputCls}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={guardando}
        onClick={() => void guardar()}
        className="mt-3 rounded-pill bg-carbon px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}
