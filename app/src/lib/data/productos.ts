/**
 * Data layer del Catálogo Maestro de productos — INTERCAMBIABLE.
 *
 * La UI solo conoce la interfaz `ProductosRepository` y el factory
 * `getProductosRepository()`. Hoy el factory devuelve
 * `MockProductosRepository` (reutiliza los datos mock de ops.ts);
 * el swap a Supabase será implementar `SupabaseProductosRepository`
 * y cambiar UNA línea del factory.
 */

import { CATEGORIAS, PRODUCTO_DIMENSIONES, PRODUCTOS } from "@/lib/data/ops";
import type {
  Producto,
  ProductoComponente,
  ProductoDimension,
} from "@/lib/types/db";

// ---------------------------------------------------------------
// Tipos enriquecidos (joins) que consume la UI
// ---------------------------------------------------------------

export interface CategoriaProducto {
  id: number;
  nombre: string;
  orden: number;
}

export interface ProductoCard {
  producto: Producto;
  categoria: CategoriaProducto;
}

export interface ProductoDetalle {
  producto: Producto;
  categoria: CategoriaProducto;
  /** Rango pedible + sobreprecio por cm (producto_dimensiones). */
  dimensiones: ProductoDimension[];
  /** BOM / despiece (producto_componentes) — vacío si no aplica. */
  componentes: ProductoComponente[];
}

export interface FiltrosProductos {
  categoria_id?: number;
  clasificacion?: Producto["clasificacion"];
  origen?: Producto["origen"];
  texto?: string; // busca en nombre + SKU + SKU Siigo
}

// ---------------------------------------------------------------
// Etiquetas de dominio compartidas por lista y detalle
// ---------------------------------------------------------------

/** Etiqueta corta de la clasificación productiva. */
export const CLASIFICACION_LABEL: Record<Producto["clasificacion"], string> = {
  MTS: "MTS · Stock",
  ATO: "ATO · Ensamble a pedido",
  MTO: "MTO · Fabricación a pedido",
};

/** Explicación completa (detalle y tooltips). */
export const CLASIFICACION_DESCRIPCION: Record<
  Producto["clasificacion"],
  string
> = {
  MTS: "Made to Stock — se vende desde inventario y se despacha de una.",
  ATO: "Assemble to Order — piezas en stock, se ensambla al recibir el pedido.",
  MTO: "Made to Order — se fabrica desde cero al confirmar el pedido.",
};

/** Etiquetas legibles de producto_componentes.categoria. */
export const CATEGORIA_COMPONENTE_LABEL: Record<string, string> = {
  columna: "Columna",
  union_perforada: "Unión perforada",
  j_lock: "J-Lock",
  barra_pull_up: "Barra pull-up",
  tornillo: "Tornillería",
  otro: "Otro",
};

// ---------------------------------------------------------------
// Interfaz del repositorio
// ---------------------------------------------------------------

export interface ProductosRepository {
  listar(filtros?: FiltrosProductos): Promise<ProductoCard[]>;
  obtener(id: string): Promise<ProductoDetalle | null>;
  listarCategorias(): Promise<CategoriaProducto[]>;
}

/** Filtro puro y compartible (lo usan el mock y la UI en vivo). */
export function aplicarFiltrosProductos(
  cards: ProductoCard[],
  filtros: FiltrosProductos,
): ProductoCard[] {
  const q = filtros.texto?.trim().toLowerCase();
  return cards.filter(({ producto }) => {
    if (
      filtros.categoria_id !== undefined &&
      producto.categoria_id !== filtros.categoria_id
    )
      return false;
    if (filtros.clasificacion && producto.clasificacion !== filtros.clasificacion)
      return false;
    if (filtros.origen && producto.origen !== filtros.origen) return false;
    if (q) {
      const blob = [producto.nombre, producto.sku, producto.sku_siigo ?? ""]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

// ===============================================================
// MOCK — reutiliza PRODUCTOS / CATEGORIAS / PRODUCTO_DIMENSIONES
// de ops.ts (una sola fuente de datos mock en toda la app)
// ===============================================================

/**
 * BOM mock SOLO para p-01 (Rack PF5) — demuestra el detalle con la
 * estructura exacta de producto_componentes. La tornillería y los
 * anclajes van con visible_cliente=false (solo producción).
 */
function comp(
  id: string,
  categoria: string,
  descripcion: string,
  cantidad: number,
  extra: Partial<ProductoComponente> = {},
): ProductoComponente {
  return {
    id,
    producto_id: "p-01",
    material_id: null,
    categoria,
    descripcion,
    cantidad,
    longitud_cm: null,
    color: null,
    color_sigue_rack: true,
    visible_cliente: true,
    ...extra,
  };
}

const COMPONENTES: ProductoComponente[] = [
  comp("bom-01", "columna", "Columna 7×7 cm cal. 11 perforada", 4, {
    longitud_cm: 230,
  }),
  comp("bom-02", "union_perforada", "Unión perforada frontal 5×5 cm", 2, {
    longitud_cm: 110,
  }),
  comp("bom-03", "union_perforada", "Unión perforada lateral 5×5 cm", 4, {
    longitud_cm: 50,
  }),
  comp("bom-04", "barra_pull_up", "Barra pull-up ø32 mm moleteada", 1, {
    longitud_cm: 110,
    color: "Negro mate",
    color_sigue_rack: false,
  }),
  comp("bom-05", "j_lock", "J-Locks en lámina 9 mm con protección UHMW (par)", 1, {
    color: "Negro mate",
    color_sigue_rack: false,
  }),
  comp("bom-06", "tornillo", 'Tornillo hexagonal 5/8" × 4" con tuerca y arandelas', 24, {
    visible_cliente: false,
  }),
  comp("bom-07", "tornillo", 'Anclaje expansivo 1/2" para piso en concreto', 8, {
    visible_cliente: false,
  }),
];

// ---------------------------------------------------------------
// Implementación mock
// ---------------------------------------------------------------

export class MockProductosRepository implements ProductosRepository {
  private categoria(id: number): CategoriaProducto {
    const c = CATEGORIAS.find((x) => x.id === id);
    if (!c) throw new Error(`Categoría ${id} no existe`);
    return c;
  }

  async listar(filtros: FiltrosProductos = {}): Promise<ProductoCard[]> {
    const cards = PRODUCTOS.filter((p) => p.activo).map((p) => ({
      producto: p,
      categoria: this.categoria(p.categoria_id),
    }));
    cards.sort(
      (a, b) =>
        a.categoria.orden - b.categoria.orden ||
        a.producto.nombre.localeCompare(b.producto.nombre, "es"),
    );
    return structuredClone(aplicarFiltrosProductos(cards, filtros));
  }

  async obtener(id: string): Promise<ProductoDetalle | null> {
    const producto = PRODUCTOS.find((p) => p.id === id && p.activo);
    if (!producto) return null;
    return structuredClone({
      producto,
      categoria: this.categoria(producto.categoria_id),
      dimensiones: PRODUCTO_DIMENSIONES.filter((d) => d.producto_id === id),
      componentes: COMPONENTES.filter((c) => c.producto_id === id),
    });
  }

  async listarCategorias(): Promise<CategoriaProducto[]> {
    return structuredClone([...CATEGORIAS].sort((a, b) => a.orden - b.orden));
  }
}

// ---------------------------------------------------------------
// Factory — ÚNICO punto de swap a Supabase
// ---------------------------------------------------------------

const globalRepo = globalThis as unknown as {
  __productosRepositorio?: ProductosRepository;
};

/**
 * Devuelve el repositorio de productos. Hoy: mock en memoria
 * (singleton por runtime, sobrevive HMR). Mañana:
 * `return new SupabaseProductosRepository(...)`.
 */
export function getProductosRepository(): ProductosRepository {
  globalRepo.__productosRepositorio ??= new MockProductosRepository();
  return globalRepo.__productosRepositorio;
}
