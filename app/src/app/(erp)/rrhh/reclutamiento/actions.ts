"use server";

import { getRrhhRepository } from "@/lib/data/rrhh";
import type { Aplicacion } from "@/lib/types/db";

/** SERVER actions de Reclutamiento — unión discriminada, nunca throw. */
export type ReclutamientoResp = { ok: true } | { ok: false; error: string };

export async function crearVacante(
  cargo: string,
  area: string | null,
): Promise<ReclutamientoResp> {
  try {
    await getRrhhRepository().crearVacante(cargo, area);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear" };
  }
}

export async function moverAplicacion(
  id: string,
  etapa: Aplicacion["etapa"],
): Promise<ReclutamientoResp> {
  try {
    await getRrhhRepository().moverAplicacion(id, etapa);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo mover" };
  }
}

export async function agregarAplicacion(input: {
  vacante_id: string;
  nombre: string;
  contacto: string | null;
}): Promise<ReclutamientoResp> {
  try {
    await getRrhhRepository().agregarAplicacion(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo agregar" };
  }
}
