/**
 * Repositorio REAL de Inventarios sobre Supabase (server-only).
 *
 * Implementa `InventarioRepository` leyendo/escribiendo las tablas
 * `existencias`, `movimientos_inventario`, `materiales`, `tipos_material`
 * y `productos`. El cliente se crea por método con `createClient()`
 * (lee la sesión del usuario en cookies → RLS aplica con su JWT), por lo
 * que la instancia del repositorio es stateless y puede ser singleton.
 *
 * Reglas que garantiza la BD (no la app):
 *   · los SALDOS solo se mueven por el trigger del kardex
 *     (fn_aplicar_movimiento): la app NUNCA hace UPDATE de `existencias`.
 *   · costo promedio ponderado sobre entradas con costo (incluye 'ajuste').
 *   · saldo nunca negativo (CHECK) y kardex inmutable.
 *   · movinv_ins exige usuario_id = auth.uid() (autoría no suplantable).
 *
 * Este archivo importa el cliente Supabase (→ next/headers), así que es
 * intrínsecamente server-only: Next aborta el build si llegara a un
 * bundle de cliente. NO debe importarse desde componentes cliente; las
 * piezas puras (tipos, estadoBuffer, filtros) siguen en `inventario.ts`.
 */
import { createClient } from "@/lib/supabase/server";
import {
  aplicarFiltrosInventario,
  type CompraMensual,
  type ExistenciaMP,
  type ExistenciaPT,
  type FiltrosInventarioMP,
  type InventarioRepository,
} from "@/lib/data/inventario";
import type {
  Existencia,
  Material,
  MovimientoInventario,
  Producto,
  TipoMaterial,
} from "@/lib/types/db";

// ---------------------------------------------------------------
// Coerción defensiva: PostgREST puede devolver `numeric` como string.
// ---------------------------------------------------------------

const num = (v: unknown): number =>
  typeof v === "string" ? Number(v) : (v as number);

/* eslint-disable @typescript-eslint/no-explicit-any */

function toExistencia(r: any): Existencia {
  return {
    id: r.id,
    producto_id: r.producto_id ?? null,
    material_id: r.material_id ?? null,
    tipo: r.tipo,
    cantidad_disponible: num(r.cantidad_disponible),
    cantidad_reservada: num(r.cantidad_reservada),
  };
}

function toMaterial(r: any): Material {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo_material_id: num(r.tipo_material_id),
    unidad_id: num(r.unidad_id),
    costo_promedio: num(r.costo_promedio),
    buffer_min: num(r.buffer_min),
    buffer_max: num(r.buffer_max),
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
  };
}

function toTipo(r: any): TipoMaterial {
  return { id: num(r.id), nombre: r.nombre };
}

function toMovimiento(r: any): MovimientoInventario {
  return {
    id: Number(r.id),
    existencia_id: r.existencia_id,
    tipo: r.tipo,
    cantidad: num(r.cantidad),
    costo_unit: r.costo_unit === null || r.costo_unit === undefined ? null : num(r.costo_unit),
    op_id: r.op_id ?? null,
    recepcion_id: r.recepcion_id ?? null,
    usuario_id: r.usuario_id ?? null,
    nota: r.nota ?? null,
    en: r.en,
  };
}

function toProducto(r: any): Producto {
  const n = (v: unknown) => (v === null || v === undefined ? null : num(v));
  return {
    id: r.id,
    sku: r.sku,
    sku_siigo: r.sku_siigo ?? null,
    shopify_product_id: r.shopify_product_id ?? null,
    nombre: r.nombre,
    descripcion: r.descripcion ?? null,
    categoria_id: num(r.categoria_id),
    clasificacion: r.clasificacion,
    origen: r.origen,
    es_rack: r.es_rack,
    unidad_id: num(r.unidad_id),
    precio_lista: num(r.precio_lista),
    costo_estandar: n(r.costo_estandar),
    ancho_cm: n(r.ancho_cm),
    profundidad_cm: n(r.profundidad_cm),
    alto_cm: n(r.alto_cm),
    peso_kg: n(r.peso_kg),
    colores_disponibles: r.colores_disponibles ?? [],
    color_default: r.color_default ?? null,
    imagen_url: r.imagen_url ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ===============================================================
// Repositorio Supabase
// ===============================================================

class SupabaseInventarioRepository implements InventarioRepository {
  async listarExistenciasMP(
    filtros: FiltrosInventarioMP = {},
  ): Promise<ExistenciaMP[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("existencias")
      .select(
        "id, producto_id, material_id, tipo, cantidad_disponible, cantidad_reservada, " +
          "materiales!inner(id, nombre, tipo_material_id, unidad_id, costo_promedio, buffer_min, buffer_max, activo, eliminado_en, tipos_material!inner(id, nombre))",
      )
      .eq("tipo", "materia_prima");
    if (error) throw new Error(error.message);

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const filas: ExistenciaMP[] = (data ?? []).map((r: any) => ({
      existencia: toExistencia(r),
      material: toMaterial(r.materiales),
      tipo: toTipo(r.materiales.tipos_material),
    }));
    filas.sort(
      (a, b) =>
        a.tipo.id - b.tipo.id ||
        a.material.nombre.localeCompare(b.material.nombre, "es"),
    );
    return aplicarFiltrosInventario(filas, filtros);
  }

  async listarExistenciasPT(): Promise<ExistenciaPT[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("existencias")
      .select(
        "id, producto_id, material_id, tipo, cantidad_disponible, cantidad_reservada, productos!inner(*)",
      )
      .eq("tipo", "terminado");
    if (error) throw new Error(error.message);

    return (data ?? [])
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .map((r: any) => ({
        existencia: toExistencia(r),
        producto: toProducto(r.productos),
      }))
      .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
  }

  async listarExistenciasSubensambles(): Promise<ExistenciaPT[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("existencias")
      .select(
        "id, producto_id, material_id, tipo, cantidad_disponible, cantidad_reservada, productos!inner(*)",
      )
      .eq("tipo", "subensamble");
    if (error) throw new Error(error.message);

    return (data ?? [])
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      .map((r: any) => ({
        existencia: toExistencia(r),
        producto: toProducto(r.productos),
      }))
      .sort((a, b) => a.producto.sku.localeCompare(b.producto.sku, "es"));
  }

  /**
   * Movimientos de una existencia. El id puede ser de un MATERIAL o de un
   * PRODUCTO (terminado o subensamble): antes solo buscaba materia prima,
   * así que el detalle de subensambles y productos terminados salía vacío.
   * Un producto puede tener existencia 'terminado' y 'en_proceso' a la vez;
   * el kardex las junta, que es lo que se espera al abrir la ficha.
   */
  async kardex(id: string): Promise<MovimientoInventario[]> {
    const supabase = await createClient();
    const { data: exs, error: exErr } = await supabase
      .from("existencias")
      .select("id")
      .or(`material_id.eq.${id},producto_id.eq.${id}`);
    if (exErr) throw new Error(exErr.message);
    const ids = (exs ?? []).map((e) => e.id);
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from("movimientos_inventario")
      .select("*")
      .in("existencia_id", ids)
      .order("en", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toMovimiento);
  }

  async comprasMensuales(meses: number): Promise<CompraMensual[]> {
    const supabase = await createClient();
    const corte = new Date();
    corte.setDate(1);
    corte.setMonth(corte.getMonth() - (meses - 1));
    corte.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("movimientos_inventario")
      .select("cantidad, costo_unit, en, existencias!inner(material_id)")
      .eq("tipo", "entrada_compra")
      .gte("en", corte.toISOString());
    if (error) throw new Error(error.message);

    const acum = new Map<string, CompraMensual>();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    for (const m of (data ?? []) as any[]) {
      const material_id: string | null = m.existencias?.material_id ?? null;
      if (!material_id) continue;
      const fecha = new Date(m.en);
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      const clave = `${material_id}|${mes}`;
      const fila = acum.get(clave) ?? {
        material_id,
        mes,
        cantidad: 0,
        costo_total: 0,
      };
      const cant = num(m.cantidad);
      fila.cantidad += cant;
      fila.costo_total += cant * (m.costo_unit === null ? 0 : num(m.costo_unit));
      acum.set(clave, fila);
    }
    return [...acum.values()].sort(
      (a, b) =>
        a.mes.localeCompare(b.mes) || a.material_id.localeCompare(b.material_id),
    );
  }

  async registrarAjuste(
    existencia_id: string,
    cantidad: number,
    nota: string,
    costo_unit?: number,
  ): Promise<MovimientoInventario> {
    // Validaciones amistosas ANTES de tocar la BD (la BD las repite con
    // CHECKs, pero el mensaje al usuario debe ser claro).
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      throw new Error("La cantidad del ajuste no puede ser cero.");
    }
    if (!nota.trim()) {
      throw new Error(
        "La nota es obligatoria: el kardex es inmutable y todo ajuste debe quedar explicado.",
      );
    }
    if (
      costo_unit !== undefined &&
      (!Number.isFinite(costo_unit) || costo_unit <= 0)
    ) {
      throw new Error("El costo unitario, si se indica, debe ser mayor que cero.");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no válida: vuelve a iniciar sesión.");

    const { data, error } = await supabase
      .from("movimientos_inventario")
      .insert({
        existencia_id,
        tipo: "ajuste",
        cantidad,
        costo_unit: costo_unit ?? null,
        usuario_id: user.id,
        nota: nota.trim(),
      })
      .select("*")
      .single();

    if (error) {
      // El CHECK de `existencias` aborta la transacción si el saldo
      // resultante quedaría negativo; lo traducimos a lenguaje de negocio.
      if (
        error.code === "23514" ||
        /cantidad_disponible|check constraint|negativ/i.test(error.message)
      ) {
        throw new Error(
          "El ajuste dejaría el saldo negativo y el inventario no admite negativos.",
        );
      }
      throw new Error(error.message || "No se pudo registrar el ajuste.");
    }
    return toMovimiento(data);
  }
}

// ---------------------------------------------------------------
// Factory — ÚNICO punto de acceso al repositorio de inventarios.
// Stateless (el cliente se crea por método con la sesión de la request),
// así que el singleton en globalThis es seguro y sobrevive HMR.
// ---------------------------------------------------------------

const globalRepo = globalThis as unknown as {
  __inventarioRepositorio?: InventarioRepository;
};

export function getInventarioRepository(): InventarioRepository {
  globalRepo.__inventarioRepositorio ??= new SupabaseInventarioRepository();
  return globalRepo.__inventarioRepositorio;
}
