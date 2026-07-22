"use server";

import {
  actualizarProducto,
  type CamposProducto,
  subirFotoProducto,
} from "@/lib/data/productos-server";
import type { Producto } from "@/lib/types/db";

export type SubirFotoResp =
  | { ok: true; producto: Producto }
  | { ok: false; error: string };

export type GuardarProductoResp =
  | { ok: true; producto: Producto }
  | { ok: false; error: string };

/** Guarda los cambios de la ficha del producto (precio, medidas, datos). */
export async function guardarProducto(
  productoId: string,
  campos: CamposProducto,
): Promise<GuardarProductoResp> {
  try {
    const producto = await actualizarProducto(productoId, campos);
    return { ok: true, producto };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el producto",
    };
  }
}

/** Sube/reemplaza la foto del producto (bucket `productos`, Admins). */
export async function subirFoto(
  productoId: string,
  formData: FormData,
): Promise<SubirFotoResp> {
  try {
    const file = formData.get("foto");
    if (!(file instanceof File)) {
      return { ok: false, error: "No se recibió la imagen." };
    }
    const producto = await subirFotoProducto(productoId, file);
    return { ok: true, producto };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo subir la foto",
    };
  }
}
