"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EmpleadoCard } from "@/lib/data/rrhh";
import { formatFechaCorta } from "@/lib/formato";
import { parseISO } from "@/lib/vacaciones-logic";
import { BadgeArea, BadgeTecnico } from "./badges";

export interface FiltrosEmpleados {
  area?: string;
  solo_tecnicos: boolean;
  texto: string;
}

interface Props {
  cards: EmpleadoCard[];
  filtrosIniciales: FiltrosEmpleados;
}

/** Acumulación alta: más de 15 días hábiles pendientes (ley: 15/año). */
export const UMBRAL_ACUMULACION = 15;

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

function antiguedad(card: EmpleadoCard): string {
  if (!card.empleado.fecha_ingreso || !card.saldo) return "—";
  const a = card.saldo.aniosServicio;
  if (a === 0) return "< 1 año";
  return a === 1 ? "1 año" : `${a} años`;
}

/**
 * Empleados: nómina completa con área, distintivo TÉCNICO (clave para los
 * permisos de Ops), antigüedad y saldo de vacaciones pendientes — en rojo
 * cuando la acumulación supera los 15 días. La ficha completa (incluido el
 * bloque confidencial) vive en /rrhh/empleados/[id].
 */
export function EmpleadosClient({ cards, filtrosIniciales }: Props) {
  const router = useRouter();
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const filtrados = useMemo(() => {
    const q = filtros.texto.trim().toLowerCase();
    return cards.filter((c) => {
      if (filtros.area && c.empleado.area !== filtros.area) return false;
      if (filtros.solo_tecnicos && !c.empleado.es_tecnico) return false;
      if (q) {
        const blob = [c.empleado.nombre, c.empleado.cargo ?? "", c.empleado.cedula]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [cards, filtros]);

  const kpis = useMemo(
    () => ({
      total: cards.length,
      tecnicos: cards.filter((c) => c.empleado.es_tecnico).length,
      deVacaciones: cards.filter((c) => c.regresaEl !== null).length,
      acumulados: cards.filter(
        (c) => (c.saldo?.pendientes ?? 0) > UMBRAL_ACUMULACION,
      ).length,
    }),
    [cards],
  );

  function actualizar(nuevos: FiltrosEmpleados) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.area) p.set("area", nuevos.area);
    if (nuevos.solo_tecnicos) p.set("tecnicos", "1");
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-[12.5px] text-neutro">Recursos Humanos /</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">Empleados</h1>
        <p className="mt-0.5 text-[12.5px] text-neutro">
          Ficha básica visible según rol; los datos confidenciales solo los ve
          Admin o el propio empleado. La nómina se liquida en Siigo.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Nómina activa", kpis.total, ""],
          ["Técnicos", kpis.tecnicos, "text-dorado-oscuro"],
          ["De vacaciones hoy", kpis.deVacaciones, ""],
          [
            "Acumulación alta (> 15 días)",
            kpis.acumulados,
            kpis.acumulados > 0 ? "text-rojo" : "",
          ],
        ].map(([label, valor, extra]) => (
          <div
            key={label as string}
            className="rounded-card border border-borde bg-card px-4 py-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              {label}
            </p>
            <p className={`text-[24px] font-extrabold ${extra}`}>{valor}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar nombre, cargo o cédula…"
          className={`${inputCls} w-full max-w-[300px]`}
        />
        <div className="flex gap-1.5">
          {(
            [
              [undefined, "Todas las áreas"],
              ["planta", "Planta"],
              ["administración", "Administración"],
            ] as const
          ).map(([clave, nombre]) => (
            <button
              key={nombre}
              type="button"
              onClick={() => actualizar({ ...filtros, area: clave })}
              className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
                filtros.area === clave
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {nombre}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            actualizar({ ...filtros, solo_tecnicos: !filtros.solo_tecnicos })
          }
          className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
            filtros.solo_tecnicos
              ? "border-dorado bg-dorado-suave text-dorado-oscuro"
              : "border-borde bg-card text-neutro hover:border-dorado"
          }`}
        >
          Solo técnicos
        </button>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtrados.length}</b> empleados
        </span>
      </div>

      {/* Tabla */}
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-3 font-bold">Empleado</th>
              <th className="px-4 py-3 font-bold">Cargo</th>
              <th className="px-4 py-3 font-bold">Área</th>
              <th className="px-4 py-3 text-right font-bold">Antigüedad</th>
              <th className="px-4 py-3 text-right font-bold">Vacaciones pendientes</th>
              <th className="px-4 py-3 font-bold">Hoy</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => {
              const pendientes = c.saldo?.pendientes ?? null;
              const acumulado =
                pendientes !== null && pendientes > UMBRAL_ACUMULACION;
              return (
                <tr
                  key={c.empleado.id}
                  onClick={() => router.push(`/rrhh/empleados/${c.empleado.id}`)}
                  className="cursor-pointer border-b border-borde bg-card last:border-0 hover:bg-sutil"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-bold">
                      {c.empleado.nombre}
                      {c.empleado.es_tecnico && <BadgeTecnico />}
                    </span>
                    <span className="text-[11.5px] text-neutro">
                      C.C. {c.empleado.cedula}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.empleado.cargo ?? "—"}</td>
                  <td className="px-4 py-3">
                    <BadgeArea area={c.empleado.area} />
                  </td>
                  <td className="px-4 py-3 text-right text-neutro">
                    {antiguedad(c)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pendientes === null ? (
                      "—"
                    ) : acumulado ? (
                      <span
                        title="Acumulación alta: más de 15 días hábiles sin disfrutar"
                        className="rounded-pill bg-rojo-bg px-2.5 py-0.5 text-[12px] font-extrabold text-rojo"
                      >
                        {pendientes} días ⚠
                      </span>
                    ) : (
                      <span className="font-semibold">{pendientes} días</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.regresaEl ? (
                      <span className="rounded-pill border border-aviso-borde bg-aviso px-2.5 py-0.5 text-[11px] font-bold text-aviso-texto">
                        De vacaciones · regresa el{" "}
                        {formatFechaCorta(parseISO(c.regresaEl))}
                      </span>
                    ) : (
                      <span className="text-neutro">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutro">
                  No hay empleados con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
