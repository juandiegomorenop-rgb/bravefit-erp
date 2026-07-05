"use server";

import {
  getCotizacionesRepository,
  type CotizacionInput,
} from "@/lib/data/crm-cotizaciones";

/**
 * Acciones del editor de cotizaciones — SERVER: el store vive en el
 * servidor. Unión discriminada (no throw) para que los mensajes de
 * negocio lleguen íntegros a la UI también en producción.
 */
export type AccionCotizacionResp =
  | { ok: true; id: string; numero: string }
  | { ok: false; error: string };

export async function crearCotizacion(
  input: CotizacionInput,
): Promise<AccionCotizacionResp> {
  try {
    const r = await getCotizacionesRepository().crear(input);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear" };
  }
}

export async function actualizarCotizacion(
  id: string,
  input: CotizacionInput,
): Promise<AccionCotizacionResp> {
  try {
    await getCotizacionesRepository().actualizar(id, input);
    return { ok: true, id, numero: "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export async function enviarCotizacion(id: string): Promise<AccionCotizacionResp> {
  try {
    await getCotizacionesRepository().marcarEnviada(id);
    return { ok: true, id, numero: "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar" };
  }
}
