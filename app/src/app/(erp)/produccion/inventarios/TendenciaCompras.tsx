"use client";

import { useMemo, useState } from "react";
import type { CompraMensual } from "@/lib/data/inventario";
import { formatCOP } from "@/lib/formato";
import { formatCantidad } from "./ui";

type Metrica = "cantidad" | "costo";

interface Props {
  compras: CompraMensual[];
  materiales: Array<{ id: string; nombre: string }>;
}

/** Últimos n meses como claves "YYYY-MM" (incluye el actual). */
function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const hoy = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** "2026-03" → "mar 26" (es-CO, sin punto). */
function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const corto = new Intl.DateTimeFormat("es-CO", { month: "short" })
    .format(new Date(anio, m - 1, 1))
    .replace(/\./g, "");
  return `${corto} ${String(anio).slice(2)}`;
}

function etiquetaValor(v: number, metrica: Metrica): string {
  if (metrica === "cantidad") return formatCantidad(Math.round(v));
  if (v >= 1_000_000)
    return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(v / 1_000_000)} M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000).toLocaleString("es-CO")} mil`;
  return formatCOP(v);
}

/**
 * Tendencia de compras mensuales — gráfico SVG casero (sin librerías):
 * barras por mes con toggle cantidad/costo y filtro por material.
 */
export function TendenciaCompras({ compras, materiales }: Props) {
  const [metrica, setMetrica] = useState<Metrica>("cantidad");
  const [materialId, setMaterialId] = useState("");

  const meses = useMemo(() => ultimosMeses(8), []);

  const valores = useMemo(
    () =>
      meses.map((mes) =>
        compras
          .filter(
            (c) => c.mes === mes && (!materialId || c.material_id === materialId),
          )
          .reduce(
            (acc, c) => acc + (metrica === "cantidad" ? c.cantidad : c.costo_total),
            0,
          ),
      ),
    [compras, meses, metrica, materialId],
  );

  const total = valores.reduce((a, v) => a + v, 0);

  // Geometría del SVG
  const W = 720;
  const H = 250;
  const padL = 66;
  const padR = 10;
  const padT = 14;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxEscala = Math.max(...valores, 1) * 1.08;
  const slot = plotW / meses.length;
  const barW = slot * 0.52;

  const unidadTitulo =
    metrica === "cantidad" ? "unidades compradas" : "costo de compras";

  return (
    <div className="rounded-card border border-borde bg-card px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div>
          <h2 className="text-[14px] font-bold">Tendencia de compras</h2>
          <p className="text-[11.5px] text-neutro">
            Últimos 8 meses · {unidadTitulo} · total{" "}
            <b className="text-carbon">
              {metrica === "cantidad"
                ? formatCantidad(total)
                : formatCOP(total)}
            </b>
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-pill border border-borde bg-sutil p-0.5">
            {(["cantidad", "costo"] as const).map((m) => (
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
                {m === "cantidad" ? "Cantidad" : "Costo"}
              </button>
            ))}
          </div>
          <select
            aria-label="Filtrar tendencia por material"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="max-w-[260px] rounded-input border border-borde bg-card px-3 py-1.5 text-[12.5px] outline-none focus:border-dorado"
          >
            <option value="">Todos los materiales</option>
            {materiales.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Compras mensuales (${unidadTitulo}) de los últimos 8 meses`}
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
        {meses.map((mes, i) => {
          const v = valores[i];
          const h = maxEscala > 0 ? (v / maxEscala) * plotH : 0;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + plotH - h;
          return (
            <g key={mes}>
              {v > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h, 2)}
                  rx={3}
                  fill="var(--color-dorado)"
                >
                  <title>
                    {`${etiquetaMes(mes)}: ${
                      metrica === "cantidad"
                        ? `${formatCantidad(v)} und`
                        : formatCOP(v)
                    }`}
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
                  fill="var(--color-neutro)"
                >
                  {etiquetaValor(v, metrica)}
                </text>
              )}
              <text
                x={padL + slot * i + slot / 2}
                y={H - padB + 16}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--color-neutro)"
              >
                {etiquetaMes(mes)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
