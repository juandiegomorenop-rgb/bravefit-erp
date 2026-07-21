"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  TRAMOS_ATRASO,
  type ResumenCumplimiento,
} from "@/lib/data/cumplimiento";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Color del cumplimiento: ≥95 % verde · ≥85 % ámbar · resto rojo. */
function tono(v: number): string {
  if (v >= 0.95) return "text-verde";
  if (v >= 0.85) return "text-ambar";
  return "text-rojo";
}

/**
 * Nivel de cumplimiento medido POR COMPROMISO (regla de Juan): la
 * cohorte es lo que se prometió entregar en el mes, no lo que salió.
 * Los atrasados sin entregar cuentan desde que vencen, en el mes que
 * se comprometieron, y contra la fecha ORIGINAL (congelada).
 */
export function CumplimientoClient({
  resumen,
  meses,
  mostrarValores,
}: {
  resumen: ResumenCumplimiento;
  meses: number;
  mostrarValores: boolean;
}) {
  const router = useRouter();
  const { serie, total, atrasadas_hoy, tramos, dias_atraso_promedio } = resumen;
  const maxBarra = Math.max(1, ...serie.map((m) => m.comprometidas));
  const valorAtrasado = atrasadas_hoy.reduce((a, f) => a + f.valor, 0);

  // Las tarjetas de antigüedad filtran la tabla de abajo (clic para
  // filtrar, clic de nuevo para quitar el filtro).
  const [tramoSel, setTramoSel] = useState<string | null>(null);
  const rangoSel = TRAMOS_ATRASO.find((t) => t.etiqueta === tramoSel);
  const atrasadasVisibles = useMemo(
    () =>
      rangoSel
        ? atrasadas_hoy.filter(
            (f) => f.dias_atraso >= rangoSel.min && f.dias_atraso <= rangoSel.max,
          )
        : atrasadas_hoy,
    [atrasadas_hoy, rangoSel],
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-neutro">Producción y Logística /</p>
          <h1 className="text-[26px] font-bold leading-tight text-carbon">
            Nivel de cumplimiento
          </h1>
          <p className="mt-1 max-w-[720px] text-[12.5px] text-neutro">
            Se mide por <b>compromiso</b>: de lo que prometimos entregar cada
            mes, cuánto salió <b>completo y a tiempo</b>. Un pedido atrasado
            cuenta desde que vence —aunque no se haya entregado— y siempre
            contra la <b>fecha original</b>, no contra las re-pactadas.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => router.push(`/produccion/cumplimiento?meses=${m}`)}
              className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
                meses === m
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-card border border-dorado bg-dorado-suave px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
            Cumplimiento ({meses} meses)
          </p>
          <p className={`text-[30px] font-extrabold ${tono(total.pct)}`}>
            {total.comprometidas ? pct(total.pct) : "—"}
          </p>
          <p className="text-[11.5px] text-neutro">
            {total.cumplidas} de {total.comprometidas} pedidos comprometidos
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
            Atrasados hoy
          </p>
          <p
            className={`text-[30px] font-extrabold ${
              atrasadas_hoy.length > 0 ? "text-rojo" : "text-verde"
            }`}
          >
            {atrasadas_hoy.length}
          </p>
          <p className="text-[11.5px] text-neutro">
            {mostrarValores && atrasadas_hoy.length > 0
              ? `${formatCOP(valorAtrasado)} sin entregar`
              : "pedidos vencidos sin entregar"}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
            Atraso promedio
          </p>
          <p className="text-[30px] font-extrabold">
            {dias_atraso_promedio}
            <span className="text-[15px] font-bold text-neutro"> días</span>
          </p>
          <p className="text-[11.5px] text-neutro">en los pedidos incumplidos</p>
        </div>
        {mostrarValores ? (
          <div className="rounded-card border border-borde bg-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Cumplimiento por valor
            </p>
            <p className={`text-[30px] font-extrabold ${tono(total.pct_valor)}`}>
              {total.valor_comprometido ? pct(total.pct_valor) : "—"}
            </p>
            <p className="text-[11.5px] text-neutro">
              pesos entregados a tiempo sobre comprometidos
            </p>
          </div>
        ) : (
          <div className="rounded-card border border-borde bg-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Pedidos re-pactados
            </p>
            <p className="text-[30px] font-extrabold">{total.repactadas}</p>
            <p className="text-[11.5px] text-neutro">
              se les movió la fecha prometida
            </p>
          </div>
        )}
      </div>

      {mostrarValores && total.repactadas > 0 && (
        <p className="mt-2 text-[12px] text-neutro">
          <b className="text-carbon">{total.repactadas}</b> pedidos del periodo
          tuvieron la fecha re-pactada — el indicador los mide contra la fecha
          original.
        </p>
      )}

      {/* Serie mensual */}
      <div className="mt-5 rounded-card border border-borde bg-card p-5">
        <p className="text-[13px] font-bold">Cumplimiento por mes de compromiso</p>
        <p className="mb-3 text-[11.5px] text-neutro">
          Cada mes agrupa los pedidos cuya fecha prometida cayó ahí y ya venció.
          Una vez cierra el mes, el número no cambia.
        </p>
        <div className="space-y-1.5">
          {serie.map((m) => (
            <div key={m.mes} className="flex items-center gap-3">
              <span className="w-[62px] shrink-0 text-[12px] text-neutro">
                {m.etiqueta}
              </span>
              <div className="flex h-6 flex-1 overflow-hidden rounded-[5px] bg-sutil">
                {m.comprometidas > 0 && (
                  <>
                    <div
                      className="h-6 bg-verde"
                      style={{
                        width: `${(m.cumplidas / maxBarra) * 100}%`,
                      }}
                      title={`${m.cumplidas} a tiempo`}
                    />
                    <div
                      className="h-6 bg-rojo"
                      style={{
                        width: `${((m.comprometidas - m.cumplidas) / maxBarra) * 100}%`,
                      }}
                      title={`${m.comprometidas - m.cumplidas} incumplidos`}
                    />
                  </>
                )}
              </div>
              <span
                className={`w-[46px] shrink-0 text-right text-[13px] font-extrabold ${
                  m.comprometidas ? tono(m.pct) : "text-neutro"
                }`}
              >
                {m.comprometidas ? pct(m.pct) : "—"}
              </span>
              <span className="w-[92px] shrink-0 text-right text-[11.5px] text-neutro">
                {m.cumplidas}/{m.comprometidas}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-neutro">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 rounded-sm bg-verde" /> A
            tiempo y completo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 rounded-sm bg-rojo" />{" "}
            Incumplido
          </span>
        </div>
      </div>

      {/* Antigüedad de la deuda viva */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tramos.map((t) => {
          const activo = tramoSel === t.etiqueta;
          return (
            <button
              key={t.etiqueta}
              type="button"
              disabled={t.n === 0}
              onClick={() => setTramoSel(activo ? null : t.etiqueta)}
              title={
                t.n === 0
                  ? "Sin pedidos en este tramo"
                  : activo
                    ? "Quitar el filtro"
                    : "Ver solo estos pedidos en la tabla"
              }
              className={`rounded-card border px-4 py-3 text-left transition-shadow ${
                activo
                  ? "border-carbon bg-carbon text-white shadow-md"
                  : t.n > 0
                    ? "border-rojo/30 bg-rojo-bg hover:border-rojo hover:shadow-sm"
                    : "cursor-default border-borde bg-card"
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  activo ? "text-white/70" : "text-neutro"
                }`}
              >
                Atraso {t.etiqueta}
              </p>
              <p
                className={`text-[24px] font-extrabold ${
                  activo ? "text-white" : t.n > 0 ? "text-rojo" : ""
                }`}
              >
                {t.n}
              </p>
              {mostrarValores && t.n > 0 && (
                <p
                  className={`text-[11px] ${activo ? "text-white/70" : "text-neutro"}`}
                >
                  {formatCOP(t.valor)}
                </p>
              )}
              {t.n > 0 && (
                <p
                  className={`mt-0.5 text-[10.5px] font-semibold ${
                    activo ? "text-dorado-claro" : "text-dorado-oscuro"
                  }`}
                >
                  {activo ? "✕ quitar filtro" : "ver pedidos →"}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detalle de atrasados vivos */}
      <div className="mt-5 overflow-x-auto rounded-card border border-borde bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="flex flex-wrap items-center gap-2 text-[14px] font-bold">
            Atrasados hoy — deuda viva
            {tramoSel && (
              <span className="flex items-center gap-1.5 rounded-pill bg-carbon px-2.5 py-0.5 text-[11px] font-bold text-white">
                {tramoSel}
                <button
                  type="button"
                  onClick={() => setTramoSel(null)}
                  aria-label="Quitar filtro"
                  className="text-white/70 hover:text-white"
                >
                  ✕
                </button>
              </span>
            )}
          </h2>
          <span className="text-[12px] text-neutro">
            {atrasadasVisibles.length} pedido
            {atrasadasVisibles.length === 1 ? "" : "s"}
            {tramoSel && ` de ${atrasadas_hoy.length}`}
          </span>
        </div>
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-borde text-left text-[11px] uppercase tracking-wider text-neutro">
              <th className="px-5 py-2.5 font-bold">O.P.</th>
              <th className="px-3 py-2.5 font-bold">Cliente</th>
              <th className="px-3 py-2.5 font-bold">Ciudad</th>
              <th className="px-3 py-2.5 font-bold">Prometida</th>
              <th className="px-3 py-2.5 text-right font-bold">Días de atraso</th>
              {mostrarValores && (
                <th className="px-5 py-2.5 text-right font-bold">Valor</th>
              )}
            </tr>
          </thead>
          <tbody>
            {atrasadasVisibles.map((f) => (
              <tr key={f.op_id} className="border-b border-borde last:border-0">
                <td className="px-5 py-2.5 font-bold">
                  <Link
                    href={`/produccion/ordenes/${f.op_id}`}
                    className="hover:underline"
                  >
                    {f.numero}
                  </Link>
                  {f.repactada && (
                    <span className="ml-2 rounded-pill bg-ambar-bg px-2 py-0.5 text-[10px] font-bold text-ambar">
                      re-pactada
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">{f.cliente}</td>
                <td className="px-3 py-2.5 text-neutro">{f.ciudad ?? "—"}</td>
                <td className="px-3 py-2.5 text-neutro">
                  {formatFechaCorta(parseFechaLocal(f.comprometida))}
                </td>
                <td className="px-3 py-2.5 text-right font-extrabold text-rojo">
                  {f.dias_atraso}
                </td>
                {mostrarValores && (
                  <td className="px-5 py-2.5 text-right">
                    {formatCOP(f.valor)}
                  </td>
                )}
              </tr>
            ))}
            {atrasadasVisibles.length === 0 && (
              <tr>
                <td
                  colSpan={mostrarValores ? 6 : 5}
                  className="px-5 py-10 text-center text-neutro"
                >
                  {tramoSel
                    ? "Ningún pedido en ese tramo de atraso."
                    : "Sin pedidos vencidos sin entregar. 🎉"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
