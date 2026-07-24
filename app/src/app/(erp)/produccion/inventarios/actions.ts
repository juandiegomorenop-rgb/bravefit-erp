"use server";

import { getInventarioRepository } from "@/lib/data/inventario-server";
import type { ConsumoEspecialItem } from "@/lib/data/inventario";

/**
 * Registrar ajuste de inventario — SERVER action: el kardex vive en el
 * servidor y las reglas (cantidad ≠ 0, saldo nunca negativo, nota
 * obligatoria) deben rechazarse con mensaje íntegro también en
 * producción. Unión discriminada, NUNCA throw al cliente.
 */
export type RegistrarAjusteResp = { ok: true } | { ok: false; error: string };

/**
 * Declarar fabricación de un subensamble — SERVER action. Sube lo
 * fabricado al estante y baja su receta en una sola transacción.
 */
export async function fabricarSubensamble(
  producto_id: string,
  cantidad: number,
  nota?: string,
): Promise<RegistrarAjusteResp> {
  try {
    await getInventarioRepository().fabricarSubensamble(
      producto_id,
      cantidad,
      nota,
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "No se pudo registrar la fabricación.",
    };
  }
}

/**
 * Registrar consumo especial de materiales — SERVER action. Piezas fuera
 * de receta, mermas, material dañado. Se descuenta como salida_produccion.
 */
export async function registrarConsumoEspecial(
  items: ConsumoEspecialItem[],
  motivo: string,
): Promise<RegistrarAjusteResp> {
  try {
    await getInventarioRepository().registrarConsumoEspecial(items, motivo);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el consumo.",
    };
  }
}

export async function registrarAjuste(
  existencia_id: string,
  cantidad: number,
  nota: string,
  costo_unit?: number,
): Promise<RegistrarAjusteResp> {
  try {
    await getInventarioRepository().registrarAjuste(
      existencia_id,
      cantidad,
      nota,
      costo_unit,
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo registrar el ajuste.",
    };
  }
}
