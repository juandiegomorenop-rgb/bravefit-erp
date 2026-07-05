"use client";

import type { AnaliticaShopify } from "@/lib/data/shopify";
import { formatCOP } from "@/lib/formato";

/**
 * "Ventas totales a lo largo del tiempo" estilo Shopify: línea sólida
 * (periodo actual) sobre línea punteada (periodo anterior). SVG casero.
 */
export function GraficoVentas({ analitica }: { analitica: AnaliticaShopify }) {
  const { serie } = analitica;
  const W = 720;
  const H = 240;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxV = Math.max(
    1,
    ...serie.map((p) => Math.max(p.actual, p.anterior)),
  );
  const n = serie.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / maxV) * innerH;

  const path = (key: "actual" | "anterior") =>
    serie.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");

  // etiquetas del eje X: ~6 marcas
  const marcas = Array.from({ length: 6 }, (_, k) =>
    Math.round((k / 5) * (n - 1)),
  );
  const fmtDia = (fecha: string) =>
    new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(
      new Date(fecha),
    );

  // marcas del eje Y (0, mitad, max)
  const marcasY = [0, maxV / 2, maxV];
  const fmtCorto = (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
        ? `$${Math.round(v / 1000)}k`
        : `$${Math.round(v)}`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Ventas totales a lo largo del tiempo"
      >
        {/* grid + eje Y */}
        {marcasY.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-borde)"
              strokeWidth={1}
            />
            <text x={padL - 8} y={y(v) + 3} textAnchor="end" className="fill-neutro text-[10px]">
              {fmtCorto(v)}
            </text>
          </g>
        ))}
        {/* periodo anterior (punteado) */}
        <path
          d={path("anterior")}
          fill="none"
          stroke="var(--color-azul)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.5}
        />
        {/* periodo actual (sólido) */}
        <path d={path("actual")} fill="none" stroke="var(--color-azul)" strokeWidth={2.2} />
        {/* eje X */}
        {marcas.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 12}
            textAnchor="middle"
            className="fill-neutro text-[10px]"
          >
            {serie[i] ? fmtDia(serie[i].fecha) : ""}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 pl-14 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-5 bg-azul" /> {analitica.etiquetaActual}
        </span>
        <span className="flex items-center gap-1.5 text-neutro">
          <span
            className="inline-block h-[2px] w-5"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, var(--color-azul) 0 4px, transparent 4px 7px)",
              opacity: 0.6,
            }}
          />
          {analitica.etiquetaAnterior}
        </span>
      </div>
      <p className="mt-2 pl-14 text-[11px] text-neutro">
        Total del periodo: <b className="text-carbon">{formatCOP(analitica.ventas.valor)}</b>
      </p>
    </div>
  );
}
