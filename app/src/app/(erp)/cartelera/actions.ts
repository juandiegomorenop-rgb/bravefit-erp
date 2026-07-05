"use server";

import { getCarteleraRepository, type NuevaPublicacion } from "@/lib/data/cartelera";

/** SERVER actions de Cartelera — unión discriminada, nunca throw. */
export type CarteleraResp = { ok: true } | { ok: false; error: string };

export async function publicar(input: NuevaPublicacion): Promise<CarteleraResp> {
  try {
    await getCarteleraRepository().publicar(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo publicar" };
  }
}

export async function comentar(input: {
  publicacion_id: string;
  cuerpo: string;
  imagen_url: string | null;
}): Promise<CarteleraResp> {
  try {
    await getCarteleraRepository().comentar(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo comentar" };
  }
}

export async function alternarReaccion(
  publicacion_id: string,
  tipo: string,
): Promise<CarteleraResp> {
  try {
    await getCarteleraRepository().alternarReaccion(publicacion_id, tipo);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo reaccionar" };
  }
}

export async function fijar(
  publicacion_id: string,
  fijada: boolean,
): Promise<CarteleraResp> {
  try {
    await getCarteleraRepository().fijar(publicacion_id, fijada);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo fijar" };
  }
}
