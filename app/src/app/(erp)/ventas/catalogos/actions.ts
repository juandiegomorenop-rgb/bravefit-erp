"use server";

import {
  getCatalogosRepository,
  type NuevaVersionInput,
  type NuevoCatalogoInput,
} from "@/lib/data/catalogos";

/**
 * Server actions de Catálogos. Toda mutación pasa por aquí (los stores mock de
 * cliente y servidor son distintos). Nunca lanzan al cliente: devuelven una
 * unión discriminada { ok } | { ok:false, error }.
 *
 * SEGURIDAD (fase mock): sin auth real. En producción, RLS exige
 * fn_puede('ventas','editar') para escribir; el bucket 'catalogos' idem.
 */

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function validarArchivo(v: NuevaVersionInput): string | null {
  if (!v.archivo_url || !v.archivo_url.startsWith("data:application/pdf")) {
    return "El archivo debe ser un PDF.";
  }
  if (v.tamano_bytes !== null && v.tamano_bytes > MAX_BYTES) {
    return "El archivo supera el límite de 25 MB.";
  }
  return null;
}

export async function crearCatalogoAction(
  input: NuevoCatalogoInput,
): Promise<Resultado<{ id: string }>> {
  if (!input.nombre?.trim()) return { ok: false, error: "El catálogo necesita un nombre." };
  const err = validarArchivo(input.primeraVersion);
  if (err) return { ok: false, error: err };
  try {
    const { id } = await getCatalogosRepository().crear(input);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el catálogo." };
  }
}

export async function subirVersionAction(
  catalogo_id: string,
  input: NuevaVersionInput,
): Promise<Resultado<{ version: number }>> {
  const err = validarArchivo(input);
  if (err) return { ok: false, error: err };
  try {
    const { version } = await getCatalogosRepository().subirVersion(catalogo_id, input);
    return { ok: true, version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir la versión." };
  }
}
