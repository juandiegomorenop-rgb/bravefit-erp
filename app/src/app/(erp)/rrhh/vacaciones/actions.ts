"use server";

import { getRrhhRepository } from "@/lib/data/rrhh";

/** SERVER actions de Vacaciones — unión discriminada, nunca throw. */
export type VacacionesResp = { ok: true } | { ok: false; error: string };

export async function solicitarVacaciones(input: {
  empleado_id: string;
  desde: string;
  dias_habiles: number;
  notas: string | null;
}): Promise<VacacionesResp> {
  try {
    await getRrhhRepository().solicitarVacaciones(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo solicitar" };
  }
}

export async function decidirVacaciones(
  id: string,
  aprobar: boolean,
  nota?: string,
): Promise<VacacionesResp> {
  try {
    await getRrhhRepository().decidirVacaciones(id, aprobar, nota);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo decidir" };
  }
}
