"use client";

import { useState } from "react";
import type { ResumenMensual } from "@/lib/data/entregas";
import { formatCOP } from "@/lib/formato";
import { mesCorto, mesLargo } from "./ui";

type Metrica = "entregas" | "valor";

interface Props {
  resumen: ResumenMensual[]; // ascendente por mes (14 meses)
  mesRecord: string | null; // 'YYYY-MM' del récord (barra dorada)
}

function etiquetaValor(v: number, metrica: Metrica): string {
  if (metrica === "entregas") return String(Math.round(v));
  if (v >= 1_000_000)
    return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(v / 1_000_000)} M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000).toLocaleString("es-CO")} mil`;
  return formatCOP(v);
}

/**
 * Entregas por mes — gráfico SVG casero (sin librerías): barras de los
 * últimos 14 meses con toggle #/valor. La barra del mes récord va en
 * dorado: es la métrica de orgullo del dueño.
 */
export function TendenciaEntregas({ resumen, mesRecord }: Props) {
  const [metrica, setMetrica] = useState<Metrica>("entregas");

  const valores = resumen.map((r) =>
    metrica === "entregas" ? r.entregas : r.valor,
  );
  const total = valores.reduce((a, v) => a + v, 0);

  // Geometría del SVG
  const W = 760;
  const H = 250;
  const padL = 66;
  const padR = 10;
  const padT = 16;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxEscala = Math.max(...valores, 1) * 1.08;
  const slot = plotW / Math.max(resumen.length, 1);
  const barW = slot * 0.56;

  const unidadTitulo =
    metrica === "entregas" ? "pedidos entregados" : "valor entregado";

  return (
    <div className="rounded-card border border-borde bg-card px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div>
          <h2 className="text-[14px] font-bold">Entregas por mes</h2>
          <p className="text-[11.5px] text-neutro">
            Últimos {resumen.length} meses · {unidadTitulo} · total{" "}
            <b className="text-carbon">
              {metrica === "entregas" ? total : formatCOP(total)}
            </b>
            {mesRecord && (
              <>
                {" "}
                · <span className="font-bold text-dorado-oscuro">■</span> récord:{" "}
                {mesLargo(mesRecord)}
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex rounded-pill border border-borde bg-sutil p-0.5">
          {(["entregas", "valor"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetrica(m)}
              className={`rounded-pill px-3 py-1 text-[12px] font-semibold transition-colors ${
                metrica === m
                  ? "bg-carbon text-white"
                  : "text-neutro hover:text-carbon"
              }`}
            >
              {m === "entregas" ? "# Entregas" : "Valor"}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Entregas mensuales (${unidadTitulo}) de los últimos ${resumen.length} meses`}
        className="w-full"
      >
        {/* Gridlines + labels del eje Y */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--color-borde)"
                strokeWidth={t === 0 ? 1.5 : 1}
              />
              <text
                x={padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-neutro)"
              >
                {etiquetaValor(maxEscala * t, metrica)}
              </text>
            </g>
          );
        })}

        {/* Barras + labels del eje X */}
        {resumen.map((r, i) => {
          const v = valores[i];
          const esRecord = r.mes === mesRecord;
          const h = maxEscala > 0 ? (v / maxEscala) * plotH : 0;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + plotH - h;
          return (
            <g key={r.mes}>
              {v > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, 2)}
                  rx={3}
                  fill={
                    esRecord ? "var(--color-dorado)" : "var(--color-carbon)"
                  }
                  fillOpacity={esRecord ? 1 : 0.72}
                >
                  <title>
                    {`${mesLargo(r.mes)}: ${r.entregas} ${
                      r.entregas === 1 ? "entrega" : "entregas"
                    } · ${formatCOP(r.valor)}${esRecord ? " · RÉCORD" : ""}`}
                  </title>
                </rect>
              )}
              {v > 0 && h > 16 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={
                    esRecord
                      ? "var(--color-dorado-oscuro)"
                      : "var(--color-neutro)"
                  }
                >
                  {etiquetaValor(v, metrica)}
                </text>
              )}
              <text
                x={padL + slot * i + slot / 2}
                y={H - padB + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight={esRecord ? "700" : "400"}
                fill={
                  esRecord
                    ? "var(--color-dorado-oscuro)"
                    : "var(--color-neutro)"
                }
              >
                {mesCorto(r.mes)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
