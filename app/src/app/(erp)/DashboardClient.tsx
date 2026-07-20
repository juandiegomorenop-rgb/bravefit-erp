"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KpisDashboard } from "@/lib/data/dashboard";
import { formatCOP } from "@/lib/formato";

export type PeriodoDash = "mes" | "trimestre" | "anio";

interface Props {
  periodo: PeriodoDash;
  kpis: KpisDashboard;
}

const num = (n: number) => n.toLocaleString("es-CO");
const pct = (v: number, d = 0) =>
  `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: d })}%`;

const PERIODOS: { clave: PeriodoDash; nombre: string }[] = [
  { clave: "mes", nombre: "Este mes" },
  { clave: "trimestre", nombre: "Trimestre" },
  { clave: "anio", nombre: "Este año" },
];

export function DashboardClient({ periodo, kpis }: Props) {
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

      {/* ================= CAPACIDAD DE PLANTA (estrella) =================
          Oculta hasta cargar el BOM de tubería: sin metros reales por
          producto el indicador sería inventado (decisión Juan 20-jul). */}
      <Tema
        titulo="🏭 Capacidad de planta"
        sub="Indicador crítico: tubería cuadrada 70×70 mm — la materia prima que nos copa"
      >
        <div className="rounded-card border border-dashed border-borde bg-card p-6 text-center">
          <p className="text-[13.5px] font-semibold text-neutro">
            📐 Se activará cuando el BOM de tubería esté cargado en el catálogo.
          </p>
          <p className="mx-auto mt-1 max-w-[560px] text-[12px] text-neutro">
            Este indicador se calcula con los metros reales de tubería por
            producto entregado (procesado vs. vendido por mes y el techo de
            capacidad de la planta). Hoy solo está cargado el BOM de platinas —
            cuando carguemos el de tubería, aparece solo.
          </p>
        </div>
      </Tema>

      {/* ================= VENTAS ================= */}
      <Tema titulo="💰 Ventas" enlace="/ventas/cotizaciones">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi titulo="Ventas del periodo" valor={formatCOP(kpis.ventas.total_periodo)} />
          <Kpi titulo="Pedidos" valor={num(kpis.ventas.pedidos)} />
          <Kpi titulo="Ticket promedio" valor={formatCOP(kpis.ventas.ticket_promedio)} />
          <Kpi titulo="Pipeline abierto (CRM)" valor={formatCOP(kpis.ventas.pipeline_valor)} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <Ranking titulo="Por vendedor" items={kpis.ventas.por_vendedor} formato="cop" />
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

      {/* ================= RRHH (módulo aún sin conectar) ================= */}
      <Tema titulo="👥 RRHH" enlace="/rrhh/empleados" ejemplo>
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
      <Tema
        titulo="📣 Mercadeo"
        enlace="/mercadeo"
        sub="Leads, cierre y valor ganado salen del embudo CRM real · ROAS disponible al conectar Meta Ads"
      >
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
  ejemplo,
  children,
}: {
  titulo: string;
  sub?: string;
  enlace?: string;
  /** true = el módulo aún no está conectado: cifras de ejemplo, en gris. */
  ejemplo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-extrabold tracking-tight">
            {titulo}
            {ejemplo && (
              <span className="rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                Datos de ejemplo · módulo sin conectar
              </span>
            )}
          </h2>
          {sub && <p className="text-[12px] text-neutro">{sub}</p>}
        </div>
        {enlace && (
          <Link href={enlace} className="text-[12.5px] font-semibold text-azul hover:underline">
            Ver módulo →
          </Link>
        )}
      </div>
      <div className={ejemplo ? "opacity-55 grayscale" : undefined}>{children}</div>
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
