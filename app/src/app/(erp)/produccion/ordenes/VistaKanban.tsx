"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OpCard } from "@/lib/data/ops";
import { formatCOP } from "@/lib/formato";
import {
  ordenarTarjetas,
  productoPrincipal,
  semaforo,
  totalOp,
} from "@/lib/ops-logic";
import type { EtapaProduccion } from "@/lib/types/db";
import {
  BadgeEsperandoProveedor,
  BadgeGarantia,
  BadgeInstalacion,
  BadgeOrigen,
  BANDA_SEMAFORO,
  PillEntrega,
} from "./badges";

interface Props {
  cards: OpCard[];
  etapas: EtapaProduccion[];
  onMoverEtapa: (cardId: string, etapaId: number) => void;
}

/**
 * Kanban: columnas = etapas de producción (En Cola → … → Instalado).
 * Drag & drop nativo HTML5; las garantías van SIEMPRE de primeras
 * en cada columna (prioridad ambulancia).
 */
export function VistaKanban({ cards, etapas, onMoverEtapa }: Props) {
  const [colDestino, setColDestino] = useState<number | null>(null);

  return (
    <div className="-mx-4 flex items-start gap-3.5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      {etapas.map((etapa) => {
        const tarjetas = ordenarTarjetas(
          cards.filter((c) => c.etapa_id === etapa.id),
        );
        return (
          <div
            key={etapa.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setColDestino(etapa.id);
            }}
            onDragLeave={() => setColDestino(null)}
            onDrop={(e) => {
              e.preventDefault();
              setColDestino(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMoverEtapa(id, etapa.id);
            }}
            className={`flex min-h-[380px] w-[264px] shrink-0 flex-col gap-2.5 rounded-card bg-kanban p-3 transition-shadow ${
              colDestino === etapa.id ? "ring-2 ring-dorado" : ""
            }`}
          >
            <div className="flex items-center justify-between px-1.5 pt-0.5">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-neutro">
                {etapa.nombre}
              </span>
              <span className="text-[11.5px] font-semibold text-neutro">
                {tarjetas.length}
              </span>
            </div>
            {tarjetas.map((card) => (
              <TarjetaOp key={card.id} card={card} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TarjetaOp({ card }: { card: OpCard }) {
  const router = useRouter();
  const sem = semaforo(card.fecha_entrega_pactada, card.fecha_entregada);
  const principal = productoPrincipal(card.items);
  const otros = card.items.length - 1;
  const total = totalOp(card.items);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => router.push(`/produccion/ordenes/${card.op_id}`)}
      className={`cursor-grab rounded-[11px] border border-[#e6e5e1] border-l-4 bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow hover:border-dorado-claro hover:shadow-[0_4px_12px_rgba(0,0,0,.1)] active:cursor-grabbing ${
        BANDA_SEMAFORO[sem]
      } ${card.tipo === "garantia" ? "ring-1 ring-semaforo-rojo/40" : ""}`}
    >
      {card.tipo === "garantia" && (
        <div className="mb-2">
          <BadgeGarantia grande />
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-[12.5px]">{card.numero}</b>
        <PillEntrega
          fecha_entrega_pactada={card.fecha_entrega_pactada}
          fecha_entregada={card.fecha_entregada}
          semaforo={sem}
        />
      </div>
      <div className="mt-1.5 text-[12.5px] font-semibold">
        {card.cliente.nombre}
      </div>
      <div className="mt-0.5 text-[11.5px] text-neutro">
        {card.tipo === "garantia"
          ? card.garantia?.problema
          : principal
            ? `${principal.producto.nombre}${otros > 0 ? ` +${otros} más` : ""}`
            : "Sin ítems"}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-neutro">
          {card.ciudad?.nombre ?? "—"}
        </span>
        {card.requiere_instalacion && <BadgeInstalacion />}
        {card.esperando_proveedor && <BadgeEsperandoProveedor />}
        <span className="ml-auto">
          <BadgeOrigen origen={card.origen} />
        </span>
      </div>
      {card.tipo === "op" && total > 0 && (
        <div className="mt-2 border-t border-borde pt-1.5 text-right text-[11.5px] font-bold text-dorado-oscuro">
          {formatCOP(total)}
        </div>
      )}
    </div>
  );
}
