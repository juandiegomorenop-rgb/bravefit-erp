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
      // Los subensambles son piezas internas de producción:
      // no aparecen en el catálogo de Ventas.
      supabase
        .from("productos")
        .select("*")
        .eq("activo", true)
        .eq("es_subensamble", false),
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

/**
 * Sube la foto del producto al bucket `productos` (público) y deja la
 * URL en productos.imagen_url. Antes las fotos vivían en el repo y
 * subir una exigía deploy; ahora las carga el equipo desde el ERP.
 * Escribir el bucket exige permiso de Ventas (RLS).
 */
export async function subirFotoProducto(
  productoId: string,
  file: File,
): Promise<Producto> {
  if (!file || file.size === 0) throw new Error("Selecciona una imagen.");
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen (JPG, PNG o WEBP).");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen no puede pesar más de 5 MB.");
  }

  const supabase = await createClient();
  const { data: prod, error: pErr } = await supabase
    .from("productos")
    .select("sku")
    .eq("id", productoId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prod) throw new Error("El producto no existe.");

  // Nombre estable por SKU + marca de tiempo: evita choques de caché
  // cuando se reemplaza la foto de un producto.
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const limpio = String(prod.sku).replace(/[^a-zA-Z0-9._-]/g, "-");
  const ruta = `${limpio}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("productos")
    .upload(ruta, file, { contentType: file.type, upsert: true });
  if (upErr) {
    if (/bucket/i.test(upErr.message) && /not found/i.test(upErr.message)) {
      throw new Error(
        "Falta crear el bucket 'productos' en Supabase (script 2026-07-20_bucket_productos.sql).",
      );
    }
    // Se muestra el error REAL de Storage: el mensaje genérico "solo un
    // Administrador" ocultaba fallos de configuración del bucket que no
    // tienen que ver con el permiso del usuario.
    throw new Error(`No se pudo subir la foto — Storage: ${upErr.message}`);
  }

  const { data: pub } = supabase.storage.from("productos").getPublicUrl(ruta);
  const { data, error } = await supabase
    .from("productos")
    .update({ imagen_url: pub.publicUrl })
    .eq("id", productoId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toProducto(data);
}

/** Campos del catálogo editables desde la ficha del producto. */
export type CamposProducto = {
  nombre: string;
  descripcion: string | null;
  categoria_id: number;
  origen: "propio" | "comercializado";
  precio_lista: number;
  costo_estandar: number | null;
  ancho_cm: number | null;
  profundidad_cm: number | null;
  alto_cm: number | null;
  peso_kg: number | null;
  sku_siigo: string | null;
};

/**
 * Edita el catálogo desde la UI (antes solo se podía por SQL, que era el
 * cuello de botella para mantener la lista de precios al día).
 * El SKU NO se edita: es la llave de las integraciones (Shopify/Siigo) y
 * de los scripts de carga. La RLS de `productos` exige permiso de Ventas.
 */
export async function actualizarProducto(
  productoId: string,
  campos: CamposProducto,
): Promise<Producto> {
  const nombre = campos.nombre.trim();
  if (!nombre) throw new Error("El nombre del producto es obligatorio.");
  if (!Number.isFinite(campos.precio_lista) || campos.precio_lista < 0) {
    throw new Error("El precio de lista no puede ser negativo.");
  }
  for (const [etiqueta, valor] of [
    ["El costo estándar", campos.costo_estandar],
    ["El ancho", campos.ancho_cm],
    ["El fondo", campos.profundidad_cm],
    ["El alto", campos.alto_cm],
    ["El peso", campos.peso_kg],
  ] as const) {
    if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
      throw new Error(`${etiqueta} no puede ser negativo.`);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .update({
      nombre,
      descripcion: campos.descripcion?.trim() || null,
      categoria_id: campos.categoria_id,
      origen: campos.origen,
      precio_lista: campos.precio_lista,
      costo_estandar: campos.costo_estandar,
      ancho_cm: campos.ancho_cm,
      profundidad_cm: campos.profundidad_cm,
      alto_cm: campos.alto_cm,
      peso_kg: campos.peso_kg,
      sku_siigo: campos.sku_siigo?.trim() || null,
    })
    .eq("id", productoId)
    .select("*")
    .single();

  if (error) {
    if (/policy|row-level|permission/i.test(error.message)) {
      throw new Error("Solo un Administrador puede editar el catálogo.");
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("El producto no existe.");
  return toProducto(data);
}

const globalRepo = globalThis as unknown as {
  __productosRepositorioServer?: ProductosRepository;
};

/** Factory server-only — las páginas de Productos consumen ESTE. */
export function getProductosRepository(): ProductosRepository {
  globalRepo.__productosRepositorioServer ??= new SupabaseProductosRepository();
  return globalRepo.__productosRepositorioServer;
}
