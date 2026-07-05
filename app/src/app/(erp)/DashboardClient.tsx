"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CapacidadTuberia,
  CuelloBotella,
  KpisDashboard,
} from "@/lib/data/dashboard";
import { formatCOP } from "@/lib/formato";

export type PeriodoDash = "mes" | "trimestre" | "anio";

interface Props {
  periodo: PeriodoDash;
  kpis: KpisDashboard;
  capacidad: CapacidadTuberia;
  cuellos: CuelloBotella[];
}

const num = (n: number) => n.toLocaleString("es-CO");
const pct = (v: number, d = 0) =>
  `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: d })}%`;

const PERIODOS: { clave: PeriodoDash; nombre: string }[] = [
  { clave: "mes", nombre: "Este mes" },
  { clave: "trimestre", nombre: "Trimestre" },
  { clave: "anio", nombre: "Este año" },
];

export function DashboardClient({ periodo, kpis, capacidad, cuellos }: Props) {
  const router = useRouter();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-[12.5px] text-neutro">
            Resumen del negocio por temas · datos del periodo seleccionado.
          </p>
        </div>
        <div className="flex gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.clave}
              type="button"
              onClick={() => router.push(`/?periodo=${p.clave}`)}
              className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
                periodo === p.clave
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* ================= CAPACIDAD DE PLANTA (estrella) ================= */}
      <Tema titulo="🏭 Capacidad de planta" sub="Indicador crítico: tubería cuadrada 70×70 mm — la materia prima que nos copa">
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="mb-1 text-[13px] font-bold">
              Metros lineales de tubería 70×70 — procesados vs. vendidos por mes
            </p>
            <p className="mb-3 text-[11.5px] text-neutro">
              Procesado = lo que ENTREGAMOS (del BOM de racks/jaulas/rigs). Vendido =
              la demanda del mes. Cuando el vendido supera al procesado, se acumula
              trabajo: ahí se ve el tope de la planta.
            </p>
            <GraficoCapacidad cap={capacidad} />
          </div>
          <div className="flex flex-col gap-3">
            <KpiGrande
              titulo="Capacidad demostrada (techo)"
              valor={`${num(capacidad.techo_m)} m`}
              nota={`Mejor mes: ${capacidad.mes_techo}`}
              destacar
            />
            <KpiGrande
              titulo="Promedio procesado / mes"
              valor={`${num(capacidad.promedio_m)} m`}
              nota={`Utilización ~${pct(capacidad.promedio_m / capacidad.techo_m)}`}
            />
            <KpiGrande
              titulo="Meses con demanda > capacidad"
              valor={`${capacidad.meses_sobre_capacidad} / 12`}
              nota={
                capacidad.meses_sobre_capacidad > 0
                  ? "En esos meses la venta nos copó la planta"
                  : "La planta cubrió toda la demanda"
              }
            />
          </div>
        </div>

        {/* Cuellos de botella */}
        <p className="mb-2 mt-5 text-[13px] font-bold">
          Otros cuellos de botella (unidades/mes)
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {cuellos.map((c) => (
            <div key={c.nombre} className="rounded-card border border-borde bg-card p-4">
              <p className="text-[12.5px] font-semibold">{c.nombre}</p>
              <div className="mt-1 flex items-end justify-between">
                <span className="text-[22px] font-extrabold">{num(c.promedio)}</span>
                <span
                  className={`text-[12px] font-bold ${c.tendencia >= 0 ? "text-verde" : "text-rojo"}`}
                >
                  {c.tendencia >= 0 ? "▲" : "▼"} {Math.abs(Math.round(c.tendencia))}%
                </span>
              </div>
              <p className="text-[11px] text-neutro">promedio/mes · {num(c.total)} en 12m</p>
              <Sparkline serie={c.serie.map((s) => s.cantidad)} />
            </div>
          ))}
        </div>
      </Tema>

      {/* ================= VENTAS ================= */}
      <Tema titulo="💰 Ventas" enlace="/ventas/cotizaciones">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="Ventas del periodo" valor={formatCOP(kpis.ventas.total_periodo)} />
          <Kpi titulo="Pedidos" valor={num(kpis.ventas.pedidos)} />
          <Kpi titulo="Ticket promedio" valor={formatCOP(kpis.ventas.ticket_promedio)} />
          <Kpi titulo="Valor ganado (mkt)" valor={formatCOP(kpis.mercadeo.valor_ganado)} />
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Ranking titulo="Por canal" items={kpis.ventas.por_canal} formato="cop" />
          <Ranking titulo="Por ciudad" items={kpis.ventas.por_ciudad} formato="cop" />
          <RankingProd titulo="Top productos" items={kpis.ventas.top_productos} />
        </div>
      </Tema>

      {/* ================= PRODUCCIÓN ================= */}
      <Tema titulo="🏭 Producción" enlace="/produccion/ordenes">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="O.P. activas" valor={num(kpis.produccion.ops_activas)} />
          <Kpi titulo="En cola" valor={num(kpis.produccion.en_cola)} />
          <Kpi
            titulo="Vencidas"
            valor={num(kpis.produccion.vencidas)}
            tono={kpis.produccion.vencidas > 0 ? "rojo" : undefined}
          />
          <Kpi
            titulo="Próximas a vencer"
            valor={num(kpis.produccion.proximas_vencer)}
            tono={kpis.produccion.proximas_vencer > 0 ? "ambar" : undefined}
          />
        </div>
        <div className="rounded-card border border-borde bg-card p-4">
          <p className="mb-2 text-[12.5px] font-bold text-neutro">O.P. activas por etapa</p>
          <div className="space-y-1.5">
            {kpis.produccion.por_etapa.map((e) => {
              const max = Math.max(1, ...kpis.produccion.por_etapa.map((x) => x.n));
              return (
                <div key={e.etapa} className="flex items-center gap-3">
                  <span className="w-[170px] shrink-0 text-[12px] text-neutro">{e.etapa}</span>
                  <div className="flex-1">
                    <div
                      className="h-5 rounded-[5px] bg-dorado"
                      style={{ width: `${Math.max(6, (e.n / max) * 100)}%` }}
                    />
                  </div>
                  <b className="w-6 text-right text-[13px]">{e.n}</b>
                </div>
              );
            })}
          </div>
        </div>
      </Tema>

      {/* ================= LOGÍSTICA ================= */}
      <Tema titulo="🚚 Logística" enlace="/produccion/entregas">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="Entregas este mes" valor={num(kpis.logistica.entregas_mes)} />
          <Kpi titulo="Entregas este año" valor={num(kpis.logistica.entregas_anio)} />
          <Kpi
            titulo="Récord mensual"
            valor={num(kpis.logistica.record_mes)}
            nota={kpis.logistica.record_etiqueta}
            tono="dorado"
          />
          <Kpi
            titulo="Garantías abiertas"
            valor={num(kpis.logistica.garantias_abiertas)}
            tono={kpis.logistica.garantias_abiertas > 0 ? "rojo" : undefined}
          />
        </div>
      </Tema>

      {/* ================= RRHH ================= */}
      <Tema titulo="👥 RRHH" enlace="/rrhh/empleados">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="Empleados" valor={num(kpis.rrhh.empleados)} />
          <Kpi titulo="Técnicos de planta" valor={num(kpis.rrhh.tecnicos)} />
          <Kpi titulo="De vacaciones ahora" valor={num(kpis.rrhh.de_vacaciones)} />
          <Kpi
            titulo="Vacaciones por aprobar"
            valor={num(kpis.rrhh.vacaciones_pendientes)}
            tono={kpis.rrhh.vacaciones_pendientes > 0 ? "ambar" : undefined}
          />
        </div>
      </Tema>

      {/* ================= MERCADEO ================= */}
      <Tema titulo="📣 Mercadeo" enlace="/mercadeo">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="Leads del periodo" valor={num(kpis.mercadeo.leads)} />
          <Kpi titulo="Tasa de cierre" valor={pct(kpis.mercadeo.tasa_cierre)} />
          <Kpi
            titulo="ROAS Meta Ads"
            valor={kpis.mercadeo.roas_meta !== null ? `${kpis.mercadeo.roas_meta.toFixed(2)}×` : "—"}
            tono={kpis.mercadeo.roas_meta && kpis.mercadeo.roas_meta >= 1 ? "verde" : undefined}
          />
          <Kpi titulo="Valor ganado" valor={formatCOP(kpis.mercadeo.valor_ganado)} />
        </div>
      </Tema>
    </div>
  );
}

// ---------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------

function Tema({
  titulo,
  sub,
  enlace,
  children,
}: {
  titulo: string;
  sub?: string;
  enlace?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold tracking-tight">{titulo}</h2>
          {sub && <p className="text-[12px] text-neutro">{sub}</p>}
        </div>
        {enlace && (
          <Link href={enlace} className="text-[12.5px] font-semibold text-azul hover:underline">
            Ver módulo →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  titulo,
  valor,
  nota,
  tono,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  tono?: "rojo" | "ambar" | "verde" | "dorado";
}) {
  const color =
    tono === "rojo"
      ? "text-rojo"
      : tono === "ambar"
        ? "text-ambar"
        : tono === "verde"
          ? "text-verde"
          : tono === "dorado"
            ? "text-dorado-oscuro"
            : "";
  return (
    <div className="rounded-card border border-borde bg-card px-4 py-3">
      <p className="text-[11.5px] font-bold text-neutro">{titulo}</p>
      <p className={`text-[21px] font-extrabold ${color}`}>{valor}</p>
      {nota && <p className="text-[11px] text-neutro">{nota}</p>}
    </div>
  );
}

function KpiGrande({
  titulo,
  valor,
  nota,
  destacar,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  destacar?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        destacar ? "border-dorado bg-dorado-suave" : "border-borde bg-card"
      }`}
    >
      <p className="text-[11.5px] font-bold text-neutro">{titulo}</p>
      <p className={`text-[24px] font-extrabold ${destacar ? "text-dorado-oscuro" : ""}`}>
        {valor}
      </p>
      {nota && <p className="text-[11.5px] text-neutro">{nota}</p>}
    </div>
  );
}

function Ranking({
  titulo,
  items,
  formato,
}: {
  titulo: string;
  items: { nombre: string; valor: number }[];
  formato: "cop";
}) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  return (
    <div className="rounded-card border border-borde bg-card p-4">
      <p className="mb-2 text-[12.5px] font-bold text-neutro">{titulo}</p>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.nombre}>
            <div className="flex justify-between text-[12.5px]">
              <span className="truncate pr-2">{i.nombre}</span>
              <b className="shrink-0">{formato === "cop" ? formatCOP(i.valor) : i.valor}</b>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-sutil">
              <div
                className="h-1.5 rounded-full bg-dorado"
                style={{ width: `${(i.valor / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-[12px] text-neutro">Sin datos en el periodo.</p>}
      </div>
    </div>
  );
}

function RankingProd({
  titulo,
  items,
}: {
  titulo: string;
  items: { nombre: string; unidades: number; valor: number }[];
}) {
  return (
    <div className="rounded-card border border-borde bg-card p-4">
      <p className="mb-2 text-[12.5px] font-bold text-neutro">{titulo}</p>
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.nombre} className="flex items-center justify-between text-[12.5px]">
            <span className="truncate pr-2">{i.nombre}</span>
            <span className="shrink-0 text-neutro">
              {i.unidades} u · <b className="text-carbon">{formatCOP(i.valor)}</b>
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="text-[12px] text-neutro">Sin datos en el periodo.</p>}
      </div>
    </div>
  );
}

/** Gráfico de capacidad: barras procesado + línea vendido + línea de techo. */
function GraficoCapacidad({ cap }: { cap: CapacidadTuberia }) {
  const W = 620;
  const H = 220;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const s = cap.serie;
  const max = Math.max(cap.techo_m, ...s.map((p) => p.vendida_m)) * 1.08;
  const n = s.length;
  const bw = (innerW / n) * 0.6;
  const x = (i: number) => padL + (i + 0.5) * (innerW / n);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const lineaVendido = s
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.vendida_m).toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="Capacidad de tubería">
        {/* techo (capacidad demostrada) */}
        <line
          x1={padL}
          x2={W - padR}
          y1={y(cap.techo_m)}
          y2={y(cap.techo_m)}
          stroke="var(--color-dorado)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={W - padR} y={y(cap.techo_m) - 4} textAnchor="end" className="fill-dorado-oscuro text-[9px] font-bold">
          Techo {num(cap.techo_m)} m
        </text>
        {/* barras procesado */}
        {s.map((p, i) => (
          <g key={p.mes}>
            <rect
              x={x(i) - bw / 2}
              y={y(p.procesada_m)}
              width={bw}
              height={padT + innerH - y(p.procesada_m)}
              rx={2}
              className="fill-azul"
              opacity={0.85}
            />
            <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-neutro text-[8.5px]">
              {p.etiqueta}
            </text>
          </g>
        ))}
        {/* línea vendido */}
        <path d={lineaVendido} fill="none" stroke="var(--color-semaforo-rojo)" strokeWidth={2} />
        {s.map((p, i) => (
          <circle key={p.mes} cx={x(i)} cy={y(p.vendida_m)} r={2.4} className="fill-semaforo-rojo" />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 pl-11 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-azul" /> Procesado (entregado)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 bg-semaforo-rojo" /> Vendido (demanda)
        </span>
        <span className="flex items-center gap-1.5 text-dorado-oscuro">
          <span className="inline-block h-[2px] w-4 border-t-2 border-dashed border-dorado" /> Capacidad
        </span>
      </div>
    </div>
  );
}

function Sparkline({ serie }: { serie: number[] }) {
  const W = 120;
  const H = 30;
  const max = Math.max(1, ...serie);
  const min = Math.min(...serie);
  const rango = max - min || 1;
  const pts = serie
    .map((v, i) => {
      const x = (i / (serie.length - 1)) * W;
      const y = H - ((v - min) / rango) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-8 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--color-dorado)" strokeWidth={1.5} />
    </svg>
  );
}
