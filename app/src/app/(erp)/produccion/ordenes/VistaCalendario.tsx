"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { OpCard } from "@/lib/data/ops";
import { semaforo } from "@/lib/ops-logic";
import { CHIP_SEMAFORO } from "./badges";
import type { CampoFechaCal } from "./OrdenesClient";

interface Props {
  cards: OpCard[];
  campoFecha: CampoFechaCal;
  onCampoFecha: (c: CampoFechaCal) => void;
}

const DIAS_SEMANA = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

function claveFecha(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Calendario mensual navegable (sin librería externa). Las O.P. se
 * ubican por fecha de entrega pactada o de creación; chips compactos
 * coloreados por semáforo (garantías siempre en rojo).
 */
export function VistaCalendario({ cards, campoFecha, onCampoFecha }: Props) {
  const [mes, setMes] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });

  const porFecha = useMemo(() => {
    const mapa = new Map<string, OpCard[]>();
    for (const c of cards) {
      const fuente =
        campoFecha === "entrega"
          ? (c.fecha_entregada ?? c.fecha_entrega_pactada)
          : c.fecha_creacion;
      if (!fuente) continue;
      // timestamps ISO → fecha local; fechas "YYYY-MM-DD" → tal cual
      const clave =
        fuente.length > 10 ? claveFecha(new Date(fuente)) : fuente.slice(0, 10);
      const lista = mapa.get(clave) ?? [];
      lista.push(c);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [cards, campoFecha]);

  const celdas = useMemo(() => {
    const primera = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const ultima = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    const inicio = new Date(primera);
    inicio.setDate(primera.getDate() - primera.getDay());
    const fin = new Date(ultima);
    fin.setDate(ultima.getDate() + (6 - ultima.getDay()));
    const out: Date[] = [];
    for (const d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      out.push(new Date(d));
    }
    return out;
  }, [mes]);

  const tituloMes = useMemo(() => {
    const t = new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(mes);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, [mes]);

  const hoyClave = claveFecha(new Date());

  return (
    <div className="flex flex-col gap-3">
      {/* Controles: campo de fecha + navegación de mes */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-neutro">Ubicar por:</span>
        {(
          [
            ["entrega", "Fecha de entrega"],
            ["creacion", "Fecha de creación"],
          ] as const
        ).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => onCampoFecha(valor)}
            className={`rounded-pill border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              campoFecha === valor
                ? "border-dorado bg-dorado-suave text-dorado-oscuro"
                : "border-borde bg-card text-carbon hover:border-dorado"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() =>
              setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))
            }
            className="h-8 w-8 rounded-pill border border-borde bg-card text-[14px] font-bold text-carbon hover:border-dorado"
          >
            ‹
          </button>
          <b className="min-w-36 text-center text-[14px]">{tituloMes}</b>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() =>
              setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))
            }
            className="h-8 w-8 rounded-pill border border-borde bg-card text-[14px] font-bold text-carbon hover:border-dorado"
          >
            ›
          </button>
        </div>
      </div>

      {/* Grilla mensual */}
      <div className="overflow-hidden rounded-card border border-borde bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-[#f0efec]">
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  className="py-2.5 text-center text-[11.5px] font-semibold text-neutro"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map((dia) => {
                const clave = claveFecha(dia);
                const delMes = dia.getMonth() === mes.getMonth();
                const esHoy = clave === hoyClave;
                const ops = porFecha.get(clave) ?? [];
                return (
                  <div
                    key={clave}
                    className={`min-h-[86px] border-b border-r border-[#f6f5f2] px-1.5 py-1.5 ${
                      delMes ? "bg-card" : "bg-sutil"
                    } ${esHoy ? "bg-dorado-suave" : ""}`}
                  >
                    <div
                      className={`text-[11.5px] font-semibold ${
                        esHoy
                          ? "text-dorado-oscuro"
                          : delMes
                            ? "text-neutro"
                            : "text-neutro/40"
                      }`}
                    >
                      {dia.getDate()}
                    </div>
                    {ops.map((c) => (
                      <ChipOp key={c.id} card={c} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipOp({ card }: { card: OpCard }) {
  const sem = semaforo(card.fecha_entrega_pactada, card.fecha_entregada);
  const clase =
    card.tipo === "garantia"
      ? "bg-semaforo-rojo text-white"
      : card.fecha_entregada
        ? "bg-verde-bg text-verde"
        : CHIP_SEMAFORO[sem];
  return (
    <Link
      href={`/produccion/ordenes/${card.op_id}`}
      title={`${card.numero} · ${card.cliente.nombre}`}
      className={`mt-1 block truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${clase}`}
    >
      {card.numero}
    </Link>
  );
}
