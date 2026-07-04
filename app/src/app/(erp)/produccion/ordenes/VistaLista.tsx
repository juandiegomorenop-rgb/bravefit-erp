"use client";

import { useRouter } from "next/navigation";
import type { OpCard } from "@/lib/data/ops";
import {
  productoPrincipal,
  progresoEntrega,
  semaforo,
  type SemaforoOp,
} from "@/lib/ops-logic";
import type { EtapaProduccion } from "@/lib/types/db";
import {
  BadgeEsperandoProveedor,
  BadgeGarantia,
  BadgeInstalacion,
  BadgeOrigen,
  FILA_SEMAFORO,
  PillEntrega,
} from "./badges";

interface Props {
  cards: OpCard[];
  etapas: EtapaProduccion[];
}

/**
 * Lista densa: mismas columnas del kanban + fecha entrega pactada
 * + % entregado. Filas coloreadas por semáforo (fondos suaves;
 * vencida = fila oscura con texto claro).
 */
export function VistaLista({ cards, etapas }: Props) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-card border border-borde bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#f0efec] text-[11.5px] font-semibold tracking-[.4px] text-neutro">
              <th className="px-4 py-3 font-semibold">O.P.</th>
              <th className="px-3 py-3 font-semibold">CLIENTE</th>
              <th className="px-3 py-3 font-semibold">CIUDAD</th>
              <th className="px-3 py-3 font-semibold">PRODUCTO PRINCIPAL</th>
              <th className="px-3 py-3 font-semibold">ORIGEN</th>
              <th className="px-3 py-3 font-semibold">INSTAL.</th>
              <th className="px-3 py-3 font-semibold">ETAPA</th>
              <th className="px-3 py-3 text-right font-semibold">ENTREGA</th>
              <th className="px-4 py-3 text-right font-semibold">% ENTREG.</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <FilaOp
                key={card.id}
                card={card}
                etapas={etapas}
                onOpen={() => router.push(`/produccion/ordenes/${card.op_id}`)}
              />
            ))}
            {cards.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-[13px] text-neutro"
                >
                  No hay órdenes que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaOp({
  card,
  etapas,
  onOpen,
}: {
  card: OpCard;
  etapas: EtapaProduccion[];
  onOpen: () => void;
}) {
  const sem = semaforo(card.fecha_entrega_pactada, card.fecha_entregada);
  const oscura = sem === "negro";
  const principal = productoPrincipal(card.items);
  const otros = card.items.length - 1;
  const progreso = card.tipo === "op" ? progresoEntrega(card.items) : null;
  const etapa = etapas.find((e) => e.id === card.etapa_id);

  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-b border-[#f6f5f2] transition-colors last:border-b-0 ${FILA_SEMAFORO[sem]}`}
    >
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex items-center gap-2">
          <b>{card.numero}</b>
          {card.tipo === "garantia" && <BadgeGarantia />}
        </div>
      </td>
      <td className="px-3 py-3">{card.cliente.nombre}</td>
      <td className={`px-3 py-3 ${oscura ? "text-white/70" : "text-neutro"}`}>
        {card.ciudad?.nombre ?? "—"}
      </td>
      <td className={`px-3 py-3 ${oscura ? "text-white/80" : "text-[#5a5a5a]"}`}>
        {card.tipo === "garantia"
          ? card.garantia?.problema
          : principal
            ? `${principal.producto.nombre}${otros > 0 ? ` +${otros} más` : ""}`
            : "—"}
        {card.esperando_proveedor && (
          <span className="ml-2 inline-block align-middle">
            <BadgeEsperandoProveedor />
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <BadgeOrigen origen={card.origen} />
      </td>
      <td className="px-3 py-3">
        {card.requiere_instalacion ? (
          <BadgeInstalacion />
        ) : (
          <span className={oscura ? "text-white/50" : "text-neutro"}>—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <span
          className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${
            oscura
              ? "bg-white/15 text-white"
              : etapa?.es_entrega || etapa?.es_terminal
                ? "bg-verde-bg text-verde"
                : "bg-neutro-bg text-neutro"
          }`}
        >
          {etapa?.nombre ?? "—"}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right">
        <PillEntrega
          fecha_entrega_pactada={card.fecha_entrega_pactada}
          fecha_entregada={card.fecha_entregada}
          semaforo={sem}
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {progreso === null ? (
          <span
            className={`block text-right text-[11px] ${oscura ? "text-white/50" : "text-neutro"}`}
          >
            n/a
          </span>
        ) : (
          <BarraProgreso progreso={progreso} sem={sem} />
        )}
      </td>
    </tr>
  );
}

function BarraProgreso({
  progreso,
  sem,
}: {
  progreso: number;
  sem: SemaforoOp;
}) {
  const oscura = sem === "negro";
  return (
    <div className="flex items-center justify-end gap-2">
      <div
        className={`h-1.5 w-14 overflow-hidden rounded-pill ${
          oscura ? "bg-white/20" : "bg-neutro-bg"
        }`}
      >
        <div
          className={`h-full rounded-pill ${progreso >= 100 ? "bg-verde" : "bg-dorado"}`}
          style={{ width: `${progreso}%` }}
        />
      </div>
      <span
        className={`w-9 text-right text-[11.5px] font-bold ${
          oscura ? "text-white" : progreso >= 100 ? "text-verde" : "text-carbon"
        }`}
      >
        {progreso}%
      </span>
    </div>
  );
}
