"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DespachoDetalle, OpItemConProducto } from "@/lib/data/ops";
import { formatCOP, formatFechaHora } from "@/lib/formato";
import { deshacerDespacho, registrarDespacho } from "../actions";

/**
 * Despachos de la O.P.: pendiente por ítem + registro de entregas parciales.
 * La BD garantiza que no se despache más de lo pendiente y que la OP solo
 * pueda marcarse Entregada con el 100% despachado (trigger + CHECK).
 */
export function DespachosOp({
  opId: _opId,
  items,
  despachos,
  total,
  progreso,
}: {
  opId: string;
  items: OpItemConProducto[];
  despachos: DespachoDetalle[];
  total: number;
  progreso: number;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});

  const pendientes = items.filter((i) => i.cantidad_entregada < i.cantidad);
  const completos = items.filter((i) => i.cantidad_entregada >= i.cantidad);

  async function deshacer(despachoId: number) {
    if (
      !window.confirm(
        "¿Reversar este despacho? La cantidad vuelve a quedar pendiente. Solo un Administrador puede hacerlo.",
      )
    )
      return;
    const r = await deshacerDespacho(despachoId);
    if (r.ok) router.refresh();
    else window.alert(r.error);
  }

  async function despachar(it: OpItemConProducto) {
    const pendiente = it.cantidad - it.cantidad_entregada;
    const cant = Number(cantidades[it.id] ?? pendiente);
    if (!Number.isFinite(cant) || cant <= 0 || cant > pendiente) {
      window.alert(`Cantidad inválida: el pendiente de este ítem es ${pendiente}.`);
      return;
    }
    setEnviando(it.id);
    try {
      const r = await registrarDespacho(it.id, cant, notas[it.id]?.trim() || undefined);
      if (r.ok) {
        setCantidades((p) => ({ ...p, [it.id]: "" }));
        setNotas((p) => ({ ...p, [it.id]: "" }));
        router.refresh(); // re-lee la OP: entregados, %, historial
      } else {
        window.alert(r.error);
      }
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="rounded-card border border-borde bg-card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-bold">
          Despachos{" "}
          <span className="ml-1 rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[11.5px] font-bold text-neutro">
            {progreso}% entregado
          </span>
        </h2>
        <b className="text-[13.5px] text-dorado-oscuro">Total O.P. {formatCOP(total)}</b>
      </div>

      {/* Pendientes por entregar (con registro de despacho parcial) */}
      {pendientes.length > 0 ? (
        <div className="mt-3 flex flex-col">
          <p className="text-[11.5px] font-semibold uppercase tracking-[.4px] text-neutro">
            Pendiente por entregar
          </p>
          {pendientes.map((it) => {
            const pendiente = it.cantidad - it.cantidad_entregada;
            return (
              <div
                key={it.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#f6f5f2] py-2.5 text-[13px] last:border-b-0"
              >
                <span className="rounded-pill bg-rojo-bg px-2 py-0.5 text-[11px] font-bold text-rojo">
                  faltan {pendiente}
                </span>
                <b className="min-w-0 flex-1 truncate">
                  {it.producto.nombre}
                  <span className="ml-2 font-normal text-neutro">
                    {it.cantidad_entregada}/{it.cantidad}
                  </span>
                </b>
                <span className="no-print flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={pendiente}
                    value={cantidades[it.id] ?? String(pendiente)}
                    onChange={(e) =>
                      setCantidades((p) => ({ ...p, [it.id]: e.target.value }))
                    }
                    aria-label={`Cantidad a despachar de ${it.producto.nombre}`}
                    className="h-8 w-16 rounded-input border border-borde bg-sutil px-2 text-right text-[12.5px] outline-none focus:border-dorado"
                  />
                  <input
                    type="text"
                    value={notas[it.id] ?? ""}
                    onChange={(e) =>
                      setNotas((p) => ({ ...p, [it.id]: e.target.value }))
                    }
                    placeholder="nota (opcional)"
                    className="h-8 w-36 rounded-input border border-borde bg-sutil px-2 text-[12px] outline-none focus:border-dorado"
                  />
                  <button
                    type="button"
                    disabled={enviando === it.id}
                    onClick={() => despachar(it)}
                    className="h-8 rounded-pill bg-carbon px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {enviando === it.id ? "…" : "Despachar"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-input bg-verde-bg px-3 py-2 text-[12.5px] font-semibold text-verde">
          ✓ Todo entregado — la O.P. puede pasar a Entregado (si el pago está completo).
        </p>
      )}

      {/* Completos */}
      {completos.length > 0 && pendientes.length > 0 && (
        <p className="mt-2 text-[11.5px] text-neutro">
          Completos: {completos.map((i) => i.producto.nombre).join(" · ")}
        </p>
      )}

      {/* Historial de despachos */}
      <div className="mt-4">
        <p className="text-[11.5px] font-semibold uppercase tracking-[.4px] text-neutro">
          Historial de despachos
        </p>
        {despachos.length === 0 ? (
          <p className="mt-1 text-[13px] text-neutro">Sin despachos registrados todavía.</p>
        ) : (
          <div className="mt-1 flex flex-col">
            {despachos.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#f6f5f2] py-2 text-[13px] last:border-b-0"
              >
                <span className="rounded-pill bg-verde-bg px-2 py-0.5 text-[11px] font-bold text-verde">
                  {d.cantidad} und
                </span>
                <b>{d.item.producto.nombre}</b>
                {d.nota && <span className="text-neutro">· {d.nota}</span>}
                <span className="ml-auto flex items-center gap-2 text-[12px] text-neutro">
                  {formatFechaHora(new Date(d.en))}
                  <button
                    type="button"
                    onClick={() => deshacer(d.id)}
                    title="Reversar despacho (solo Administrador)"
                    className="no-print rounded-pill px-2 py-0.5 text-[11px] font-semibold text-rojo hover:bg-rojo-bg"
                  >
                    deshacer
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
