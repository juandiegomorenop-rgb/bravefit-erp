/**
 * Capa de datos de ANÁLISIS DE VENTAS (submódulo de Ventas).
 *
 * Fuente de verdad: las MISMAS OPs que alimentan el dashboard y las entregas
 * (getOpsRepository). Cada OP se aplana a nivel de LÍNEA (una fila por ítem),
 * y cada línea lleva todas las dimensiones —cliente, vendedor, ciudad, canal,
 * segmento B2B/B2C, producto, categoría, propio/comercializado— para poder
 * filtrar y agrupar por cualquiera de forma coherente (los filtros de segmento
 * y propio/comercializado recomponen los totales por OP sin doble conteo).
 *
 * El vendedor es el REAL de la OP (`op.vendedor`, heredado de la cotización);
 * las OPs sin vendedor (Shopify) se agrupan como "Tienda online".
 *
 * Swap a Supabase = implementar SupabaseAnalisisRepository sobre `v_ventas`
 * (o las líneas de OP) y cambiar UNA línea del factory.
 */

import {
  CATEGORIAS,
  getOpsRepository,
  type OpCard,
} from "@/lib/data/ops";
import type { RangoFechas } from "@/lib/data/mercadeo";

export type DimensionVenta =
  | "cliente"
  | "vendedor"
  | "producto"
  | "categoria"
  | "ciudad"
  | "canal";

export const DIMENSIONES: { clave: DimensionVenta; nombre: string }[] = [
  { clave: "cliente", nombre: "Cliente" },
  { clave: "vendedor", nombre: "Vendedor" },
  { clave: "producto", nombre: "Producto" },
  { clave: "categoria", nombre: "Categoría" },
  { clave: "ciudad", nombre: "Ciudad" },
  { clave: "canal", nombre: "Canal" },
];

export interface FiltrosAnalisis extends RangoFechas {
  segmento?: "B2B" | "B2C";
  origenProducto?: "propio" | "comercializado";
}

export interface AgrupadoVenta {
  nombre: string;
  valor: number;
  unidades: number;
  pedidos: number;
}

export interface PuntoSerie {
  mes: string; // 'YYYY-MM'
  etiqueta: string; // 'jul 26'
  valor: number;
}

export interface Particion {
  nombre: string;
  valor: number;
  pedidos: number;
}

export interface ResumenAnalisis {
  total: number;
  pedidos: number;
  unidades: number;
  ticket: number;
  /** Tendencia: últimos 12 meses (respeta segmento y propio/comercializado). */
  serie_mensual: PuntoSerie[];
  /** Ranking por cada dimensión (respeta el rango + filtros). */
  por: Record<DimensionVenta, AgrupadoVenta[]>;
  por_segmento: Particion[]; // B2B vs B2C
  por_origen_producto: Particion[]; // propio vs comercializado
}

export interface AnalisisVentasRepository {
  resumen(filtros: FiltrosAnalisis): Promise<ResumenAnalisis>;
}

// ---------------------------------------------------------------
// Línea de venta (aplanado de OP × ítem)
// ---------------------------------------------------------------

interface LineaVenta {
  op_id: string;
  fecha: string; // 'YYYY-MM-DD' (fecha de creación = fecha de venta)
  cliente: string;
  vendedor: string;
  ciudad: string;
  canal: string;
  segmento: "B2B" | "B2C" | null;
  producto: string;
  categoria: string;
  origen_producto: "propio" | "comercializado";
  unidades: number;
  valor: number;
}

const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const CAT_NOMBRE = new Map(CATEGORIAS.map((c) => [c.id, c.nombre]));

/** Vendedor REAL de la OP; las OPs sin vendedor (Shopify) → "Tienda online". */
function vendedorDe(op: OpCard): string {
  if (op.vendedor) return op.vendedor.nombre;
  return op.origen.clave === "shopify" ? "Tienda online" : "Sin asignar";
}

function aplanar(cards: OpCard[]): LineaVenta[] {
  const lineas: LineaVenta[] = [];
  for (const op of cards) {
    if (op.tipo !== "op") continue; // solo ventas, no garantías
    const vendedor = vendedorDe(op);
    const fecha = op.fecha_creacion.slice(0, 10);
    for (const it of op.items) {
      lineas.push({
        op_id: op.op_id,
        fecha,
        cliente: op.cliente.nombre,
        vendedor,
        ciudad: op.ciudad?.nombre ?? "Sin ciudad",
        canal: op.origen.nombre,
        segmento: op.segmento,
        producto: it.producto.nombre,
        categoria: CAT_NOMBRE.get(it.producto.categoria_id) ?? "Sin categoría",
        origen_producto: it.producto.origen,
        unidades: it.cantidad,
        valor: it.cantidad * it.precio_unit,
      });
    }
  }
  return lineas;
}

// ---------------------------------------------------------------
// Agregaciones
// ---------------------------------------------------------------

function agrupar(lineas: LineaVenta[], dim: DimensionVenta): AgrupadoVenta[] {
  const m = new Map<string, { valor: number; unidades: number; ops: Set<string> }>();
  for (const l of lineas) {
    const k = l[dim];
    const cur = m.get(k) ?? { valor: 0, unidades: 0, ops: new Set<string>() };
    cur.valor += l.valor;
    cur.unidades += l.unidades;
    cur.ops.add(l.op_id);
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([nombre, v]) => ({ nombre, valor: v.valor, unidades: v.unidades, pedidos: v.ops.size }))
    .sort((a, b) => b.valor - a.valor);
}

function particion(lineas: LineaVenta[], campo: "segmento" | "origen_producto"): Particion[] {
  const m = new Map<string, { valor: number; ops: Set<string> }>();
  for (const l of lineas) {
    const k = (l[campo] ?? "Sin dato") as string;
    const cur = m.get(k) ?? { valor: 0, ops: new Set<string>() };
    cur.valor += l.valor;
    cur.ops.add(l.op_id);
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([nombre, v]) => ({ nombre, valor: v.valor, pedidos: v.ops.size }))
    .sort((a, b) => b.valor - a.valor);
}

function ultimosMeses(n: number): { clave: string; etiqueta: string }[] {
  const hoy = new Date();
  const out: { clave: string; etiqueta: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push({
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: `${MESES_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  return out;
}

// ===============================================================
// MOCK
// ===============================================================

export class MockAnalisisVentasRepository implements AnalisisVentasRepository {
  async resumen(filtros: FiltrosAnalisis): Promise<ResumenAnalisis> {
    const cards = await getOpsRepository().listarOps();
    const todas = aplanar(cards);

    // Filtro por segmento / propio-comercializado (aplica a serie y a rangos).
    const base = todas.filter(
      (l) =>
        (!filtros.segmento || l.segmento === filtros.segmento) &&
        (!filtros.origenProducto || l.origen_producto === filtros.origenProducto),
    );

    // Serie: últimos 12 meses (independiente del rango, para ver tendencia).
    const meses = ultimosMeses(12);
    const porMes = new Map<string, number>();
    for (const l of base) porMes.set(l.fecha.slice(0, 7), (porMes.get(l.fecha.slice(0, 7)) ?? 0) + l.valor);
    const serie_mensual = meses.map((m) => ({ mes: m.clave, etiqueta: m.etiqueta, valor: porMes.get(m.clave) ?? 0 }));

    // Rango seleccionado para KPIs y rankings.
    const enRango = base.filter((l) => l.fecha >= filtros.desde && l.fecha <= filtros.hasta);
    const total = enRango.reduce((a, l) => a + l.valor, 0);
    const unidades = enRango.reduce((a, l) => a + l.unidades, 0);
    const pedidos = new Set(enRango.map((l) => l.op_id)).size;

    return {
      total,
      pedidos,
      unidades,
      ticket: pedidos ? total / pedidos : 0,
      serie_mensual,
      por: {
        cliente: agrupar(enRango, "cliente"),
        vendedor: agrupar(enRango, "vendedor"),
        producto: agrupar(enRango, "producto"),
        categoria: agrupar(enRango, "categoria"),
        ciudad: agrupar(enRango, "ciudad"),
        canal: agrupar(enRango, "canal"),
      },
      por_segmento: particion(enRango, "segmento"),
      por_origen_producto: particion(enRango, "origen_producto"),
    };
  }
}

// ---------------------------------------------------------------
// Factory (globalThis singleton — sobrevive HMR)
// ---------------------------------------------------------------

const g = globalThis as unknown as { __analisisVentasRepo?: AnalisisVentasRepository };

export function getAnalisisVentasRepository(): AnalisisVentasRepository {
  g.__analisisVentasRepo ??= new MockAnalisisVentasRepository();
  return g.__analisisVentasRepo;
}
