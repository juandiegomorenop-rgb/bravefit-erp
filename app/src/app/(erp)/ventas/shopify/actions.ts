"use server";

import { getShopifyRepository } from "@/lib/data/shopify";

/** SERVER action: convertir pedido Shopify pagado en OP. */
export type ShopifyResp =
  | { ok: true; op_id: string; numero: string }
  | { ok: false; error: string };

export async function generarOpDesdePedido(pedido_id: string): Promise<ShopifyResp> {
  try {
    const r = await getShopifyRepository().generarOp(pedido_id);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo generar la O.P." };
  }
}
