/**
 * Data layer de Entregas — INTERCAMBIABLE (espejo conceptual de v_entregas).
 *
 * La UI solo conoce la interfaz `EntregasRepository` y el factory
 * `getEntregasRepository()`. Hoy el factory devuelve
 * `MockEntregasRepository`: ~14 meses de entregas históricas generadas
 * con fechas relativas a hoy + las OPs entregadas "vivas" del kanban
 * (getOpsRepository), deduplicadas por número. El swap a Supabase será
 * implementar `SupabaseEntregasRepository` sobre la vista `v_entregas`
 * y cambiar UNA línea del factory.
 */

import { CIUDADES, CLIENTES, PRODUCTOS, fechaRel, getOpsRepository } from "@/lib/data/ops";
import { productoPrincipal, totalOp } from "@/lib/ops-logic";

// ---------------------------------------------------------------
// Tipos que consume la UI
// ---------------------------------------------------------------

/** Fila de entrega — espejo de v_entregas + joins que la UI necesita. */
export interface EntregaRow {
  /** null en el histórico migrado (sin OP en el sistema → sin link). */
  op_id: string | null;
  numero: string; // OP-XXXX
  cliente_nombre: string;
  ciudad_nombre: string;
  producto_principal: string;
  unidades: number; // Σ cantidad de los ítems
  valor: number; // Σ cantidad × precio_unit (COP)
  fecha_entregada: string; // 'YYYY-MM-DD'
  requiere_instalacion: boolean;
  origen_clave: string; // 'cotizacion' | 'shopify' | 'whatsapp' | 'planner'
}

export interface FiltrosEntregas {
  mes?: string; // 'YYYY-MM'
  anio?: number;
  ciudad?: string; // nombre exacto de la ciudad
  texto?: string; // busca en número, cliente, ciudad, producto y origen
}

/** Agregado mensual para KPIs y gráfico (mes 'YYYY-MM'). */
export interface ResumenMensual {
  mes: string;
  entregas: number;
  valor: number;
}

export interface EntregasRepository {
  /** Entregas (histórico + vivas), descendentes por fecha entregada. */
  listar(filtros?: FiltrosEntregas): Promise<EntregaRow[]>;
  /**
   * Serie de los últimos `meses` meses (incluye el actual), ascendente
   * por mes y con ceros en los meses sin entregas.
   */
  resumenMensual(meses: number): Promise<ResumenMensual[]>;
}

/** Etiqueta legible por clave de origen (espejo de la tabla origenes_op). */
export const ORIGEN_LABEL: Record<string, string> = {
  cotizacion: "Cotización",
  shopify: "Shopify",
  whatsapp: "WhatsApp",
  planner: "Planner",
};

/** Filtro puro y compartible (lo usan el mock y la UI en vivo). */
export function aplicarFiltrosEntregas(
  filas: EntregaRow[],
  filtros: FiltrosEntregas,
): EntregaRow[] {
  const q = filtros.texto?.trim().toLowerCase();
  return filas.filter((f) => {
    if (filtros.mes && !f.fecha_entregada.startsWith(filtros.mes)) return false;
    if (
      filtros.anio !== undefined &&
      Number(f.fecha_entregada.slice(0, 4)) !== filtros.anio
    )
      return false;
    if (filtros.ciudad && f.ciudad_nombre !== filtros.ciudad) return false;
    if (q) {
      const blob = [
        f.numero,
        f.cliente_nombre,
        f.ciudad_nombre,
        f.producto_principal,
        ORIGEN_LABEL[f.origen_clave] ?? f.origen_clave,
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

// ===============================================================
// MOCK — ~14 meses de histórico + OPs entregadas vivas del kanban
// ===============================================================

/** PRNG determinista (mulberry32): el histórico es estable en el runtime. */
function rng(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "YYYY-MM-DD" en el mes `mesesAtras` (0 = actual), día `dia` — clamp al
 * último día del mes y a HOY (el mock nunca entrega en el futuro).
 * Se apoya en fechaRel de ops.ts para mantener el mock siempre vigente.
 */
function fechaEnMes(mesesAtras: number, dia: number): string {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diff = Math.min(0, Math.round((d.getTime() - hoy0.getTime()) / 86_400_000));
  return fechaRel(diff);
}

/**
 * Entregas por mes del histórico: índice 0 = hace 13 meses … 13 = mes
 * actual. UN récord claro de 12 (hace 7 meses); el mes actual arranca
 * bajo porque lo completan las OPs vivas del kanban.
 */
const PLAN_MENSUAL = [6, 4, 7, 5, 8, 6, 12, 7, 9, 5, 8, 6, 7, 4] as const;

/**
 * Histórico determinista: clientes/ciudades/productos reales del mock de
 * OPs, numeración OP-XXXX consecutiva que desemboca en las OPs vivas
 * (OP-1041…) y sin op_id (histórico migrado → sin detalle navegable).
 */
function generarHistorico(): EntregaRow[] {
  const r = rng(20_260_704);
  const total = PLAN_MENSUAL.reduce((a, n) => a + n, 0);
  let consecutivo = 1041 - total; // …termina en OP-1040
  const out: EntregaRow[] = [];

  PLAN_MENSUAL.forEach((cuantas, idx) => {
    const mesesAtras = PLAN_MENSUAL.length - 1 - idx;
    const dias = Array.from({ length: cuantas }, () => 2 + Math.floor(r() * 26))
      .sort((a, b) => a - b);

    for (const dia of dias) {
      const cliente = CLIENTES[Math.floor(r() * CLIENTES.length)];
      const ciudad = CIUDADES.find((c) => c.id === cliente.ciudad_id);
      const producto = PRODUCTOS[Math.floor(r() * PRODUCTOS.length)];
      const principales = producto.es_rack
        ? 1 + Math.floor(r() * 2)
        : 1 + Math.floor(r() * 4);
      const accesorios = Math.floor(r() * 4);
      const pOrigen = r();

      out.push({
        op_id: null,
        numero: `OP-${consecutivo++}`,
        cliente_nombre: cliente.nombre,
        ciudad_nombre: ciudad?.nombre ?? "—",
        producto_principal: producto.nombre,
        unidades: principales + accesorios,
        valor: producto.precio_lista * principales + accesorios * 350_000,
        fecha_entregada: fechaEnMes(mesesAtras, dia),
        requiere_instalacion: producto.es_rack && r() < 0.6,
        origen_clave:
          pOrigen < 0.35
            ? "cotizacion"
            : pOrigen < 0.65
              ? "shopify"
              : pOrigen < 0.85
                ? "whatsapp"
                : "planner",
      });
    }
  });

  return out;
}

// ---------------------------------------------------------------
// Implementación mock
// ---------------------------------------------------------------

export class MockEntregasRepository implements EntregasRepository {
  private historico: EntregaRow[] = generarHistorico();

  /**
   * Histórico + OPs entregadas VIVAS del kanban (fecha_entregada != null,
   * tipo 'op' — las garantías no son ventas), deduplicando por número:
   * la OP viva manda sobre cualquier fila histórica homónima.
   */
  private async todas(): Promise<EntregaRow[]> {
    const cards = await getOpsRepository().listarOps();
    const porNumero = new Map<string, EntregaRow>();
    for (const h of this.historico) porNumero.set(h.numero, h);
    for (const c of cards) {
      if (c.tipo !== "op" || !c.fecha_entregada) continue;
      porNumero.set(c.numero, {
        op_id: c.op_id,
        numero: c.numero,
        cliente_nombre: c.cliente.nombre,
        ciudad_nombre: c.ciudad?.nombre ?? "—",
        producto_principal:
          productoPrincipal(c.items)?.producto.nombre ?? "—",
        unidades: c.items.reduce((s, i) => s + i.cantidad, 0),
        valor: totalOp(c.items),
        fecha_entregada: c.fecha_entregada.slice(0, 10),
        requiere_instalacion: c.requiere_instalacion,
        origen_clave: c.origen.clave,
      });
    }
    return [...porNumero.values()];
  }

  async listar(filtros: FiltrosEntregas = {}): Promise<EntregaRow[]> {
    const filas = aplicarFiltrosEntregas(await this.todas(), filtros);
    filas.sort(
      (a, b) =>
        b.fecha_entregada.localeCompare(a.fecha_entregada) ||
        b.numero.localeCompare(a.numero),
    );
    return structuredClone(filas);
  }

  async resumenMensual(meses: number): Promise<ResumenMensual[]> {
    const hoy = new Date();
    const serie: ResumenMensual[] = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      serie.push({ mes, entregas: 0, valor: 0 });
    }
    const indice = new Map(serie.map((s, i) => [s.mes, i]));
    for (const e of await this.todas()) {
      const i = indice.get(e.fecha_entregada.slice(0, 7));
      if (i === undefined) continue;
      serie[i].entregas += 1;
      serie[i].valor += e.valor;
    }
    return serie;
  }
}

// ---------------------------------------------------------------
// Factory — ÚNICO punto de swap a Supabase
// ---------------------------------------------------------------

const globalRepo = globalThis as unknown as {
  __entregasRepositorio?: EntregasRepository;
};

/**
 * Devuelve el repositorio de entregas. Hoy: mock en memoria (singleton
 * por runtime, sobrevive HMR). Mañana:
 * `return new SupabaseEntregasRepository(...)`.
 */
export function getEntregasRepository(): EntregasRepository {
  globalRepo.__entregasRepositorio ??= new MockEntregasRepository();
  return globalRepo.__entregasRepositorio;
}
