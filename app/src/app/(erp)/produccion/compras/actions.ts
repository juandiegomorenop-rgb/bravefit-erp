"use server";

import {
  type RecepcionItemInput,
  type ScItemInput,
} from "@/lib/data/compras";
import { getComprasRepository } from "@/lib/data/compras-server";
import type { SolicitudCompra } from "@/lib/types/db";

/** SERVER actions de Compras — unión discriminada, nunca throw al cliente. */
export type ComprasResp = { ok: true; numero?: string } | { ok: false; error: string };

export async function crearSolicitud(input: {
  tipo_material_id: number;
  notas: string | null;
  items: ScItemInput[];
}): Promise<ComprasResp> {
  try {
    const r = await getComprasRepository().crear(input);
    return { ok: true, numero: r.numero };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear" };
  }
}

export async function cambiarEstadoSc(
  id: string,
  estado: SolicitudCompra["estado"],
  datos?: {
    valor_estimado?: number;
    fecha_entrega?: string;
    proveedor_id?: string | null;
  },
): Promise<ComprasResp> {
  try {
    await getComprasRepository().cambiarEstado(id, estado, datos);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cambiar" };
  }
}

export async function registrarRecepcion(
  sc_id: string,
  items: RecepcionItemInput[],
): Promise<ComprasResp> {
  try {
    await getComprasRepository().registrarRecepcion(sc_id, items);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar" };
  }
}

export async function resolverFaltante(
  recepcion_item_id: string,
  nota?: string,
): Promise<ComprasResp> {
  try {
    await getComprasRepository().resolverFaltante(recepcion_item_id, nota);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo resolver" };
  }
}
