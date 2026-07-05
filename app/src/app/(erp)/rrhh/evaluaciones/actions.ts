"use server";

import { getRrhhRepository } from "@/lib/data/rrhh";
import type { Evaluacion } from "@/lib/types/db";

/** SERVER actions de Evaluaciones — unión discriminada, nunca throw al cliente. */
export type EvaluacionesResp =
  | { ok: true; estado: Evaluacion["estado"] }
  | { ok: false; error: string };

/**
 * Guarda los puntajes de una evaluación. Regla: si TODOS los criterios
 * quedaron puntuados (> 0) la evaluación pasa a 'completada'; si hay
 * criterios aún en 0, queda 'en_curso'.
 */
export async function guardarEvaluacionAction(
  id: string,
  criterios: { nombre: string; puntaje: number }[],
): Promise<EvaluacionesResp> {
  try {
    if (criterios.length === 0) {
      return { ok: false, error: "La evaluación no tiene criterios que guardar" };
    }
    const estado: Evaluacion["estado"] = criterios.every((c) => c.puntaje > 0)
      ? "completada"
      : "en_curso";
    await getRrhhRepository().guardarEvaluacion(id, { criterios, estado });
    return { ok: true, estado };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la evaluación",
    };
  }
}
