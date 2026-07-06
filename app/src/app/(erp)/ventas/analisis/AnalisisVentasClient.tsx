"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIMENSIONES, type DimensionVenta, type ResumenAnalisis } from "@/lib/data/analisis-ventas";
import { formatCOP } from "@/lib/formato";

export type PeriodoAn = "mes" | "trimestre" | "anio" | "12m";

interface Props {
  periodo: PeriodoAn;
  segmento: "B2B" | "B2C" | null;
  origen: "propio" | "comercializado" | null;
  resumen: ResumenAnalisis;
}

const num = (n: number) => n.toLocaleString("es-CO");
const compactoCOP = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M`
    : formatCOP(n);

const PERIODOS: { clave: PeriodoAn; nombre: string }[] = [
  { clave: "mes", nombre: "Este mes" },
  { clave: "trimestre", nombre: "Trimestre" },
  { clave: "anio", nombre: "Este año" },
  { clave: "12m", nombre: "12 meses" },
];

export function AnalisisVentasClient({ periodo, segmento, origen, resumen }: Props) {
  const router = useRouter();
  const [dim, setDim] = useState<DimensionVenta>("cliente");

  /** Empuja un filtro a la URL (refetch en el servidor). */
  function setFiltro(clave: string, valor: string | null) {
    const p = new URLSearchParams();
    if (periodo !== "12m") p.set("periodo", periodo);
    if (segmento) p.set("segmento", segmento);
    if (origen) p.set("origen", origen);
    if (valor === null) p.delete(clave);
    else p.set(clave, valor);
    // periodo por defecto (12m) no se escribe
    if (clave === "periodo" && valor === "12m") p.delete("periodo");
    const qs = p.toString();
    router.push(qs ? `/ventas/analisis?${qs}` : "/ventas/analisis");
  }

  const ranking = resumen.por[dim];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-[28px] font-extrabold tracking-tight">Análisis de ventas</h1>
        <p className="text-[12.5px] text-neutro">
          Ventas por cliente, vendedor, producto, categoría, ciudad y canal · B2B vs B2C · propio vs comercializado.
        </p>
      </div>

      {/* Barra de filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmentado
          etiqueta="Periodo"
          opciones={PERIODOS.map((p) => ({ clave: p.clave, nombre: p.nombre }))}
          activo={periodo}
          onSel={(v) => setFiltro("periodo", v)}
        />
        <Segmentado
          etiqueta="Segmento"
          opciones={[
            { clave: "", nombre: "Todos" },
            { clave: "B2B", nombre: "B2B" },
            { clave: "B2C", nombre: "B2C" },
          ]}
          activo={segmento ?? ""}
          onSel={(v) => setFiltro("segmento", v || null)}
        />
        <Segmentado
          etiqueta="Producto"
          opciones={[
            { clave: "", nombre: "Todos" },
            { clave: "propio", nombre: "Propio" },
            { clave: "comercializado", nombre: "Comercializado" },
          ]}
          activo={origen ?? ""}
          onSel={(v) => setFiltro("origen", v || null)}
        />
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Ventas del periodo" valor={formatCOP(resumen.total)} />
        <Kpi titulo="Pedidos" valor={num(resumen.pedidos)} />
        <Kpi titulo="Ticket promedio" valor={formatCOP(resumen.ticket)} />
        <Kpi titulo="Unidades" valor={num(resumen.unidades)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Tendencia + particiones */}
        <div className="space-y-5 lg:col-span-1">
          <div className="rounded-card border border-borde bg-card p-4">
            <p className="mb-1 text-[12.5px] font-bold text-neutro">Tendencia · 12 meses</p>
            <p className="mb-2 text-[11px] text-neutro">Respeta los filtros de segmento y producto.</p>
            <GraficoMensual serie={resumen.serie_mensual} />
          </div>
          <Particiones titulo="B2B vs B2C" items={resumen.por_segmento} total={resumen.total} />
          <Particiones
            titulo="Propio vs comercializado"
            items={resumen.por_origen_producto}
            total={resumen.total}
          />
        </div>

        {/* Ranking por dimensión */}
        <div className="rounded-card border border-borde bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-bold">Ranking por dimensión</p>
            <div className="flex flex-wrap gap-1">
              {DIMENSIONES.map((d) => (
                <button
                  key={d.clave}
                  onClick={() => setDim(d.clave)}
                  className={`rounded-pill px-3 py-1 text-[12px] font-semibold transition-colors ${
                    dim === d.clave
                      ? "bg-carbon text-white"
                      : "bg-sutil text-carbon hover:bg-dorado-suave"
                  }`}
                >
                  {d.nombre}
                </button>
              ))}
            </div>
          </div>
          <TablaRanking items={ranking} total={resumen.total} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------

function Segmentado({
  etiqueta,
  opciones,
  activo,
  onSel,
}: {
  etiqueta: string;
  opciones: { clave: string; nombre: string }[];
  activo: string;
  onSel: (clave: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-neutro">{etiqueta}</p>
      <div className="inline-flex rounded-pill border border-borde bg-card p-0.5">
        {opciones.map((o) => (
          <button
            key={o.clave}
            onClick={() => onSel(o.clave)}
            className={`rounded-pill px-3 py-1 text-[12.5px] font-semibold transition-colors ${
              activo === o.clave ? "bg-carbon text-white" : "text-carbon hover:text-dorado-oscuro"
            }`}
          >
            {o.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-card border border-borde bg-card px-4 py-3">
      <p className="text-[11.5px] font-bold text-neutro">{titulo}</p>
      <p className="text-[22px] font-extrabold">{valor}</p>
    </div>
  );
}

function TablaRanking({
  items,
  total,
}: {
  items: { nombre: string; valor: number; unidades: number; pedidos: number }[];
  total: number;
}) {
  if (items.length === 0) {
    return <p className="text-[12.5px] text-neutro">Sin ventas en el periodo con estos filtros.</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.valor));
  const lista = items.slice(0, 15);
  return (
    <div>
      <div className="mb-1 flex items-center gap-3 px-1 text-[10.5px] font-bold uppercase tracking-wide text-neutro">
        <span className="flex-1">Nombre</span>
        <span className="w-16 text-right">Pedidos</span>
        <span className="w-16 text-right">Unid.</span>
        <span className="w-28 text-right">Valor</span>
        <span className="w-12 text-right">%</span>
      </div>
      <div className="space-y-1.5">
        {lista.map((i, idx) => (
          <div key={i.nombre} className="rounded-lg px-1 py-1 hover:bg-sutil">
            <div className="flex items-center gap-3 text-[12.5px]">
              <span className="flex-1 truncate">
                <span className="mr-1.5 text-neutro">{idx + 1}.</span>
                {i.nombre}
              </span>
              <span className="w-16 text-right text-neutro">{num(i.pedidos)}</span>
              <span className="w-16 text-right text-neutro">{num(i.unidades)}</span>
              <b className="w-28 text-right">{formatCOP(i.valor)}</b>
              <span className="w-12 text-right text-[11.5px] text-neutro">
                {total ? Math.round((i.valor / total) * 100) : 0}%
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-sutil">
              <div className="h-1.5 rounded-full bg-dorado" style={{ width: `${(i.valor / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {items.length > lista.length && (
        <p className="mt-2 text-[11px] text-neutro">
          Mostrando top {lista.length} de {items.length}.
        </p>
      )}
    </div>
  );
}

function Particiones({
  titulo,
  items,
  total,
}: {
  titulo: string;
  items: { nombre: string; valor: number; pedidos: number }[];
  total: number;
}) {
  const COLORES = ["bg-carbon", "bg-dorado", "bg-azul"];
  const suma = items.reduce((a, i) => a + i.valor, 0) || 1;
  return (
    <div className="rounded-card border border-borde bg-card p-4">
      <p className="mb-2 text-[12.5px] font-bold text-neutro">{titulo}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-neutro">Sin datos.</p>
      ) : (
        <>
          <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-sutil">
            {items.map((i, idx) => (
              <div
                key={i.nombre}
                className={COLORES[idx % COLORES.length]}
                style={{ width: `${(i.valor / suma) * 100}%` }}
                title={`${i.nombre}: ${formatCOP(i.valor)}`}
              />
            ))}
          </div>
          <div className="space-y-1">
            {items.map((i, idx) => (
              <div key={i.nombre} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${COLORES[idx % COLORES.length]}`} />
                  {i.nombre}
                </span>
                <span className="text-neutro">
                  <b className="text-carbon">{formatCOP(i.valor)}</b> ·{" "}
                  {total ? Math.round((i.valor / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Barras mensuales de ventas (12 meses). */
function GraficoMensual({ serie }: { serie: { etiqueta: string; valor: number }[] }) {
  const W = 320;
  const H = 130;
  const padT = 8;
  const padB = 20;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...serie.map((p) => p.valor));
  const n = serie.length;
  const bw = (W / n) * 0.62;
  const x = (i: number) => (i + 0.5) * (W / n);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[300px]" role="img" aria-label="Ventas por mes">
        {serie.map((p, i) => (
          <g key={p.etiqueta}>
            <rect
              x={x(i) - bw / 2}
              y={y(p.valor)}
              width={bw}
              height={padT + innerH - y(p.valor)}
              rx={2}
              className="fill-dorado"
            />
            {(i % 2 === 0 || n <= 6) && (
              <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-neutro text-[8px]">
                {p.etiqueta}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-right text-[10.5px] text-neutro">
        Máx. mes: {compactoCOP(max)}
      </p>
    </div>
  );
}
