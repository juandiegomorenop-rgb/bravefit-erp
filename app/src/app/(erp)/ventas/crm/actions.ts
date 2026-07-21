"use server";

import { getCrmRepository } from "@/lib/data/crm-cotizaciones-server";
import type { OportunidadNuevaInput } from "@/lib/data/crm-cotizaciones";

/**
 * Mover ficha del embudo — SERVER action: el store vive en el servidor,
 * así la OP creada al ganar existe cuando el usuario navega a Producción.
 * Devuelve unión discriminada (no throw): los mensajes de negocio deben
 * llegar íntegros a la UI también en producción.
 */
export type MoverEtapaCrmResp =
  | { ok: true; opCreada?: { id: string; numero: string } }
  | { ok: false; error: string };

export type CrearOportunidadResp = { ok: true } | { ok: false; error: string };

/** Descartar ficha del embudo (error/prueba) — no es un cierre Perdido. */
export async function descartarOportunidad(
  id: string,
): Promise<CrearOportunidadResp> {
  try {
    await getCrmRepository().descartarOportunidad(id);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "No se pudo descartar la oportunidad.",
    };
  }
}

/** Alta manual de un lead al embudo (entra a la primera etapa). */
export async function crearOportunidad(
  input: OportunidadNuevaInput,
): Promise<CrearOportunidadResp> {
  try {
    await getCrmRepository().crearOportunidad(input);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo crear la oportunidad.",
    };
  }
}

export async function moverEtapaCrm(
  oportunidad_id: string,
  etapa_id: number,
): Promise<MoverEtapaCrmResp> {
  try {
    const r = await getCrmRepository().moverEtapa(oportunidad_id, etapa_id);
    return { ok: true, opCreada: r.opCreada };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo mover la ficha.",
    };
  }
}
