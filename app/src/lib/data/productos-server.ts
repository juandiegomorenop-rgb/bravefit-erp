/**
 * Repositorio REAL del Catálogo Maestro sobre Supabase (server-only):
 * los 127 productos cargados en la BD (fuente de la verdad del
 * catálogo), sus dimensiones variables y su BOM (producto_componentes).
 * `productos.ts` conserva tipos + filtro puro + mock (dev sin Supabase).
 */
import {
  aplicarFiltrosProductos,
  type CategoriaProducto,
  type FiltrosProductos,
  type ProductoCard,
  type ProductoDetalle,
  type ProductosRepository,
} from "@/lib/data/productos";
import { createClient } from "@/lib/supabase/server";
import type {
  Producto,
  ProductoComponente,
  ProductoDimension,
} from "@/lib/types/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number =>
  typeof v === "string" ? Number(v) : (v as number);
const numN = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

function toProducto(r: any): Producto {
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
    costo_estandar: numN(r.costo_estandar),
    ancho_cm: numN(r.ancho_cm),
    profundidad_cm: numN(r.profundidad_cm),
    alto_cm: numN(r.alto_cm),
    peso_kg: numN(r.peso_kg),
    colores_disponibles: r.colores_disponibles ?? [],
    color_default: r.color_default ?? null,
    imagen_url: r.imagen_url ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
  };
}

class SupabaseProductosRepository implements ProductosRepository {
  async listarCategorias(): Promise<CategoriaProducto[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categorias_producto")
      .select("*")
      .order("orden");
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      id: num(c.id),
      nombre: c.nombre,
      orden: num(c.orden),
    }));
  }

  async listar(filtros: FiltrosProductos = {}): Promise<ProductoCard[]> {
    const supabase = await createClient();
    const [{ data, error }, categorias] = await Promise.all([
      supabase.from("productos").select("*").eq("activo", true),
      this.listarCategorias(),
    ]);
    if (error) throw new Error(error.message);
    const catMap = new Map(categorias.map((c) => [c.id, c]));
    const cards: ProductoCard[] = (data ?? []).map((r) => {
      const producto = toProducto(r);
      return {
        producto,
        categoria: catMap.get(producto.categoria_id) ?? {
          id: producto.categoria_id,
          nombre: "—",
          orden: 99,
        },
      };
    });
    cards.sort(
      (a, b) =>
        a.categoria.orden - b.categoria.orden ||
        a.producto.nombre.localeCompare(b.producto.nombre, "es"),
    );
    return aplicarFiltrosProductos(cards, filtros);
  }

  async obtener(id: string): Promise<ProductoDetalle | null> {
    const supabase = await createClient();
    const { data: r, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .eq("activo", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    const producto = toProducto(r);

    const [categorias, { data: dims }, { data: comps }] = await Promise.all([
      this.listarCategorias(),
      supabase.from("producto_dimensiones").select("*").eq("producto_id", id),
      supabase
        .from("producto_componentes")
        .select("*, materiales(nombre)")
        .eq("producto_id", id),
    ]);

    const dimensiones: ProductoDimension[] = (dims ?? []).map((d: any) => ({
      id: d.id,
      producto_id: d.producto_id,
      eje: d.eje,
      min_cm: num(d.min_cm),
      max_cm: num(d.max_cm),
      default_cm: num(d.default_cm),
      precio_por_cm_extra: num(d.precio_por_cm_extra),
    }));
    const componentes: ProductoComponente[] = (comps ?? []).map((c: any) => ({
      id: c.id,
      producto_id: c.producto_id,
      material_id: c.material_id ?? null,
      categoria: c.categoria,
      descripcion: c.descripcion || c.materiales?.nombre || "—",
      cantidad: num(c.cantidad),
      longitud_cm: numN(c.longitud_cm),
      color: c.color ?? null,
      color_sigue_rack: c.color_sigue_rack,
      visible_cliente: c.visible_cliente,
    }));

    return {
      producto,
      categoria: categorias.find((c) => c.id === producto.categoria_id) ?? {
        id: producto.categoria_id,
        nombre: "—",
        orden: 99,
      },
      dimensiones,
      componentes,
    };
  }
}

const globalRepo = globalThis as unknown as {
  __productosRepositorioServer?: ProductosRepository;
};

/** Factory server-only — las páginas de Productos consumen ESTE. */
export function getProductosRepository(): ProductosRepository {
  globalRepo.__productosRepositorioServer ??= new SupabaseProductosRepository();
  return globalRepo.__productosRepositorioServer;
}
