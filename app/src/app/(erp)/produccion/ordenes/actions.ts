"use server";

import { eliminarDespacho, getOpsRepository } from "@/lib/data/ops-server";
import type { OpObservacion } from "@/lib/types/db";

/**
 * Acciones de servidor del módulo OPs. El tablero (isla cliente) no puede
 * llamar al repositorio Supabase directamente (es server-only), así que las
 * mutaciones del kanban y las observaciones pasan por aquí. Nunca lanzan:
 * devuelven un resultado que el cliente usa para confirmar u optimista-revertir.
 */

export type MoverResp = { ok: true } | { ok: false; error: string };
export type ObsResp =
  | { ok: true; obs: OpObservacion }
  | { ok: false; error: string };

export async function moverEtapa(
  cardId: string,
  etapaId: number,
): Promise<MoverResp> {
  try {
    await getOpsRepository().moverEtapa(cardId, etapaId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al mover la O.P." };
  }
}

export async function agregarObservacion(
  opId: string,
  texto: string,
): Promise<ObsResp> {
  try {
    const obs = await getOpsRepository().agregarObservacion(opId, texto);
    return { ok: true, obs };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo agregar la observación." };
  }
}

export async function registrarDespacho(
  opItemId: string,
  cantidad: number,
  nota?: string,
): Promise<MoverResp> {
  try {
    await getOpsRepository().registrarDespacho(opItemId, cantidad, nota);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar el despacho." };
  }
}

export async function anularOp(
  opId: string,
  motivo: string,
): Promise<MoverResp> {
  try {
    await getOpsRepository().anularOp(opId, motivo);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo anular la O.P." };
  }
}

export async function deshacerDespacho(despachoId: number): Promise<MoverResp> {
  try {
    await eliminarDespacho(despachoId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo reversar el despacho." };
  }
}
