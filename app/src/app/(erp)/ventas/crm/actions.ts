"use server";

import { getCrmRepository } from "@/lib/data/crm-cotizaciones-server";

/**
 * Mover ficha del embudo — SERVER action: el store vive en el servidor,
 * así la OP creada al ganar existe cuando el usuario navega a Producción.
 * Devuelve unión discriminada (no throw): los mensajes de negocio deben
 * llegar íntegros a la UI también en producción.
 */
export type MoverEtapaCrmResp =
  | { ok: true; opCreada?: { id: string; numero: string } }
  | { ok: false; error: string };

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
