"use server";

import {
  completarDatosCliente,
  crearClienteRapido,
  crearProducto,
  getCotizacionesRepository,
  type ClienteNuevoInput,
  type ProductoNuevoInput,
} from "@/lib/data/crm-cotizaciones-server";
import { type CotizacionInput } from "@/lib/data/crm-cotizaciones";
import type { Cliente, Producto } from "@/lib/types/db";

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
  /** Oportunidad del CRM a la que se vincula (en vez de crear otra). */
  oportunidadId?: string,
): Promise<AccionCotizacionResp> {
  try {
    const r = await getCotizacionesRepository().crear(input, oportunidadId);
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

export async function duplicarCotizacion(
  id: string,
): Promise<AccionCotizacionResp> {
  try {
    const r = await getCotizacionesRepository().duplicar(id);
    return { ok: true, ...r };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo duplicar",
    };
  }
}

export async function anularCotizacion(id: string): Promise<AccionCotizacionResp> {
  try {
    await getCotizacionesRepository().anular(id);
    return { ok: true, id, numero: "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo anular" };
  }
}

export type CrearProductoResp =
  | { ok: true; producto: Producto }
  | { ok: false; error: string };

export type CrearClienteResp =
  | { ok: true; cliente: Cliente }
  | { ok: false; error: string };

/** Alta rápida de cliente desde el editor de cotizaciones. */
export async function crearClienteCatalogo(
  input: ClienteNuevoInput,
): Promise<CrearClienteResp> {
  try {
    const cliente = await crearClienteRapido(input);
    return { ok: true, cliente };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo crear el cliente",
    };
  }
}

/** Completar/actualizar datos del cliente (cédula-NIT, correo, ciudad,
 *  dirección) sin salir del editor ni del embudo. */
export async function guardarDatosCliente(
  clienteId: string,
  datos: {
    tipo: "persona" | "empresa";
    nombre: string;
    nit_cedula: string | null;
    telefono: string | null;
    email: string | null;
    ciudad_id: number | null;
    ciudad_nueva?: { nombre: string; departamento: string } | null;
    direccion?: string | null;
  },
): Promise<CrearClienteResp> {
  try {
    const cliente = await completarDatosCliente(clienteId, datos);
    return { ok: true, cliente };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "No se pudieron guardar los datos",
    };
  }
}

/** Alta rápida desde el editor: el producto nace en la BD (fuente de la
 *  verdad del catálogo) y queda listo para cotizarse de inmediato. */
export async function crearProductoCatalogo(
  input: ProductoNuevoInput,
): Promise<CrearProductoResp> {
  try {
    const producto = await crearProducto(input);
    return { ok: true, producto };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo crear el producto",
    };
  }
}
