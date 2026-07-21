"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EvaluacionCard } from "@/lib/data/rrhh";
import type { Evaluacion } from "@/lib/types/db";
import { BadgeTecnico } from "../empleados/badges";
import { guardarEvaluacionAction } from "./actions";

interface Props {
  cards: EvaluacionCard[];
  ciclos: string[];
  ciclo: string | null;
}

/** Criterios base cuando una evaluación pendiente aún no tiene ninguno. */
const CRITERIOS_BASE = [
  "Calidad del trabajo",
  "Cumplimiento",
  "Trabajo en equipo",
  "Seguridad y orden",
];

const ESTADOS: Record<
  Evaluacion["estado"],
  { nombre: string; badge: string }
> = {
  pendiente: { nombre: "Pendiente", badge: "bg-neutro-bg text-neutro" },
  en_curso: { nombre: "En curso", badge: "bg-azul-bg text-azul" },
  completada: { nombre: "Completada", badge: "bg-verde-bg text-verde" },
};

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

function BarraPuntaje({ puntaje }: { puntaje: number | null }) {
  if (puntaje === null) {
    return <span className="text-neutro">—</span>;
  }
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-[90px] overflow-hidden rounded-pill bg-neutro-bg">
        <span
          className="block h-full rounded-pill bg-dorado"
          style={{ width: `${(puntaje / 5) * 100}%` }}
        />
      </span>
      <b className="w-[52px] text-right">
        {puntaje}
        <span className="font-semibold text-neutro"> / 5</span>
      </b>
    </span>
  );
}

/**
 * Evaluaciones de desempeño por ciclo: selector de ciclo (el cambio
 * recarga los datos del servidor), KPIs del ciclo y tabla con panel
 * expandible para puntuar los criterios 0–5 — se guarda vía server
 * action y queda 'completada' cuando todos los criterios están puntuados.
 */
export function EvaluacionesClient({ cards, ciclos, ciclo }: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const completadas = cards.filter((c) => c.evaluacion.estado === "completada");
    const pendientes = cards.filter((c) => c.evaluacion.estado !== "completada");
    const puntajes = completadas
      .map((c) => c.evaluacion.puntaje)
      .filter((p): p is number => p !== null);
    const promedio =
      puntajes.length > 0
        ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 100) /
          100
        : null;
    return {
      completadas: completadas.length,
      pendientes: pendientes.length,
      promedio,
    };
  }, [cards]);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[12.5px] text-neutro">Recursos Humanos /</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">
          Evaluaciones de desempeño
        </h1>
        <p className="mt-0.5 text-[12.5px] text-neutro">
          Puntaje sobre 5 por criterios. La evaluación queda completada cuando
          todos los criterios están puntuados.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      {/* Selector de ciclo */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutro">
          Ciclo
        </span>
        <div className="flex gap-1.5">
          {ciclos.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setAbierta(null);
                setError(null);
                router.push(`/rrhh/evaluaciones?ciclo=${encodeURIComponent(c)}`);
              }}
              className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
                ciclo === c
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{cards.length}</b> evaluaciones en el ciclo
        </span>
      </div>

      {/* KPIs del ciclo */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          ["Completadas", kpis.completadas, kpis.completadas > 0 ? "text-verde" : ""],
          ["Pendientes", kpis.pendientes, kpis.pendientes > 0 ? "text-rojo" : ""],
          [
            "Promedio del ciclo",
            kpis.promedio !== null ? `${kpis.promedio} / 5` : "—",
            "text-dorado-oscuro",
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

      {/* Tabla */}
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-3 font-bold">Empleado</th>
              <th className="px-4 py-3 font-bold">Cargo</th>
              <th className="px-4 py-3 text-right font-bold">Puntaje / 5</th>
              <th className="px-4 py-3 font-bold">Estado</th>
              <th className="px-4 py-3 font-bold">Evaluador</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <FilaEvaluacion
                key={c.evaluacion.id}
                card={c}
                abierta={abierta === c.evaluacion.id}
                onToggle={() =>
                  setAbierta(abierta === c.evaluacion.id ? null : c.evaluacion.id)
                }
                onError={setError}
                onRefrescar={() => router.refresh()}
              />
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-neutro">
                  No hay evaluaciones en este ciclo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function FilaEvaluacion({
  card: c,
  abierta,
  onToggle,
  onError,
  onRefrescar,
}: {
  card: EvaluacionCard;
  abierta: boolean;
  onToggle: () => void;
  onError: (e: string | null) => void;
  onRefrescar: () => void;
}) {
  const ev = c.evaluacion;
  const editable = ev.estado !== "completada";
  // Precarga: una evaluación pendiente sin criterios arranca con los 4 base en 0.
  const [criterios, setCriterios] = useState(
    ev.criterios.length > 0
      ? ev.criterios
      : CRITERIOS_BASE.map((nombre) => ({ nombre, puntaje: 0 })),
  );
  const [guardando, setGuardando] = useState(false);

  const est = ESTADOS[ev.estado];
  const todosPuntuados = criterios.every((cr) => cr.puntaje > 0);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await guardarEvaluacionAction(ev.id, criterios);
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onRefrescar();
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-borde ${
          abierta ? "bg-sutil" : "bg-card hover:bg-sutil"
        }`}
      >
        <td className="px-4 py-3">
          <span className="flex items-center gap-2 font-bold">
            <span className="inline-block w-3 text-neutro">
              {abierta ? "▾" : "▸"}
            </span>
            <Link
              href={`/rrhh/empleados/${c.empleado.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
            >
              {c.empleado.nombre}
            </Link>
            {c.empleado.es_tecnico && <BadgeTecnico />}
          </span>
        </td>
        <td className="px-4 py-3 text-neutro">{c.empleado.cargo ?? "—"}</td>
        <td className="px-4 py-3 text-right">
          <BarraPuntaje puntaje={ev.puntaje} />
        </td>
        <td className="px-4 py-3">
          <span
            className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${est.badge}`}
          >
            {est.nombre}
          </span>
        </td>
        <td className="px-4 py-3 text-neutro">
          {c.evaluador?.nombre.split(" ")[0] ?? "—"}
        </td>
      </tr>
      {abierta && (
        <tr className="border-b border-borde bg-sutil/60">
          <td colSpan={5} className="px-6 pb-5 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Criterios (0–5)
            </p>
            <div className="mt-2 max-w-[560px] space-y-2">
              {criterios.map((cr, idx) => (
                <div
                  key={cr.nombre}
                  className="flex flex-wrap items-center gap-3 text-[12.5px]"
                >
                  <span className="min-w-[180px] flex-1 font-semibold">
                    {cr.nombre}
                  </span>
                  {editable ? (
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      aria-label={`Puntaje de ${cr.nombre}`}
                      className={`${inputCls} w-[84px] py-1 text-right`}
                      value={cr.puntaje}
                      onChange={(e) => {
                        const v = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                        setCriterios((cs) =>
                          cs.map((x, i) => (i === idx ? { ...x, puntaje: v } : x)),
                        );
                      }}
                    />
                  ) : (
                    <b className="w-[52px] text-right">{cr.puntaje}</b>
                  )}
                  <span className="h-1.5 w-[110px] overflow-hidden rounded-pill bg-neutro-bg">
                    <span
                      className="block h-full rounded-pill bg-dorado"
                      style={{ width: `${(cr.puntaje / 5) * 100}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
            {editable && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void guardar()}
                  className="rounded-pill bg-carbon px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar evaluación"}
                </button>
                <span className="text-[12px] font-semibold text-neutro">
                  {todosPuntuados
                    ? "Todos los criterios puntuados: quedará COMPLETADA."
                    : "Hay criterios en 0: quedará EN CURSO."}
                </span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
