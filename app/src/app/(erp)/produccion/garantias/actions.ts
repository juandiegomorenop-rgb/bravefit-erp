"use server";

import { getOpsRepository } from "@/lib/data/ops-server";
import { type GarantiaCrearInput } from "@/lib/data/ops";
import type { Garantia } from "@/lib/types/db";

/** SERVER actions de Garantías — unión discriminada, nunca throw. */
export type GarantiaResp =
  | { ok: true; id?: string; numero?: string }
  | { ok: false; error: string };

export async function crearGarantia(input: GarantiaCrearInput): Promise<GarantiaResp> {
  try {
    const g = await getOpsRepository().crearGarantia(input);
    return { ok: true, id: g.id, numero: g.numero };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear" };
  }
}

export async function actualizarGarantia(
  id: string,
  patch: Partial<
    Pick<Garantia, "recogida" | "costo_resolucion" | "detalle" | "vendedor_id">
  >,
): Promise<GarantiaResp> {
  try {
    await getOpsRepository().actualizarGarantia(id, patch);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}
