/**
 * Data layer de Inventarios (UNA sola bodega) — núcleo COMPARTIBLE.
 *
 * Este módulo es seguro de importar desde componentes cliente: contiene
 * SOLO tipos, funciones puras (estadoBuffer, filtros) y el mock. El
 * repositorio real vive en `inventario-server.ts` (server-only, importa
 * el cliente Supabase) y el factory `getInventarioRepository()` también.
 * La UI de servidor toma el factory de ese módulo; la de cliente importa
 * de aquí solo lo puro.
 *
 * Reglas replicadas de la BD (0001_esquema.sql · sección 10):
 *   · kardex inmutable: toda corrección es un movimiento 'ajuste' nuevo
 *   · cantidad <> 0 y el saldo NUNCA queda negativo (CHECK >= 0)
 *   · entradas con costo sobre materia prima actualizan el costo
 *     promedio ponderado (fn_aplicar_movimiento)
 */

import { MATERIALES, TIPOS_MATERIAL } from "@/lib/data/materiales-mock";
import { PRODUCTOS } from "@/lib/data/ops";
import type {
  Existencia,
  Material,
  MovimientoInventario,
  Producto,
  TipoMaterial,
} from "@/lib/types/db";

// ---------------------------------------------------------------
// Tipos enriquecidos (joins) que consume la UI
// ---------------------------------------------------------------

export interface ExistenciaMP {
  existencia: Existencia;
  material: Material; // costo_promedio VIVO (lo mantiene el kardex)
  tipo: TipoMaterial;
}

export interface ExistenciaPT {
  existencia: Existencia;
  producto: Producto;
}

/** Serie mensual de compras por material (tendencias). */
export interface CompraMensual {
  material_id: string;
  mes: string; // "YYYY-MM"
  cantidad: number;
  costo_total: number; // Σ cantidad × costo_unit del mes
}

export interface FiltrosInventarioMP {
  tipo_material_id?: number;
  texto?: string; // busca en nombre del material y del tipo
  solo_bajo_buffer?: boolean;
}

// ---------------------------------------------------------------
// Dominio compartido (lista, kardex y detalle)
// ---------------------------------------------------------------

/** unidades del seed: 1=und · 2=m · 3=kg · 4=gl. */
export const UNIDAD_LABEL: Record<number, string> = {
  1: "und",
  2: "m",
  3: "kg",
  4: "gl",
};

export const TIPO_MOVIMIENTO_LABEL: Record<
  MovimientoInventario["tipo"],
  string
> = {
  entrada_compra: "Entrada por compra",
  salida_produccion: "Salida a producción",
  entrada_produccion: "Entrada de producción",
  salida_venta: "Salida por venta",
  ajuste: "Ajuste",
  devolucion: "Devolución",
  entrada_garantia: "Entrada por garantía",
  salida_garantia: "Salida por garantía",
};

export type EstadoBuffer = "reponer" | "ok" | "exceso";

/** Semáforo de reposición por consumo (Simple Solutions). */
export function estadoBuffer(disponible: number, m: Material): EstadoBuffer {
  if (disponible < m.buffer_min) return "reponer";
  if (disponible > m.buffer_max) return "exceso";
  return "ok";
}

/** Filtro puro y compartible (lo usan el mock y la UI en vivo). */
export function aplicarFiltrosInventario(
  filas: ExistenciaMP[],
  filtros: FiltrosInventarioMP,
): ExistenciaMP[] {
  const q = filtros.texto?.trim().toLowerCase();
  return filas.filter(({ existencia, material, tipo }) => {
    if (
      filtros.tipo_material_id !== undefined &&
      material.tipo_material_id !== filtros.tipo_material_id
    )
      return false;
    if (
      filtros.solo_bajo_buffer &&
      estadoBuffer(existencia.cantidad_disponible, material) !== "reponer"
    )
      return false;
    if (q && !`${material.nombre} ${tipo.nombre}`.toLowerCase().includes(q))
      return false;
    return true;
  });
}

// ---------------------------------------------------------------
// Interfaz del repositorio
// ---------------------------------------------------------------

export interface InventarioRepository {
  listarExistenciasMP(filtros?: FiltrosInventarioMP): Promise<ExistenciaMP[]>;
  listarExistenciasPT(): Promise<ExistenciaPT[]>;
  /** Movimientos del material, descendentes por fecha. */
  kardex(material_id: string): Promise<MovimientoInventario[]>;
  /** Serie por material de los últimos `meses` meses (incluye el actual). */
  comprasMensuales(meses: number): Promise<CompraMensual[]>;
  /**
   * Ajuste manual de saldo — réplica de las reglas de la BD:
   * cantidad ≠ 0, saldo resultante >= 0, nota obligatoria (kardex
   * auditable) y costo opcional que actualiza el promedio ponderado
   * en entradas de materia prima.
   */
  registrarAjuste(
    existencia_id: string,
    cantidad: number,
    nota: string,
    costo_unit?: number,
  ): Promise<MovimientoInventario>;
}

// ===============================================================
// MOCK — existencias + ~8 meses de kardex coherente por material
// ===============================================================

/** PRNG determinista (mulberry32): el mock es estable dentro del runtime. */
function rng(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Timestamp ISO `mesesAtras` meses antes de hoy, día `dia` (clamp a hoy). */
function tsMes(mesesAtras: number, dia: number, hora = 9): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesAtras);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  d.setHours(hora, 0, 0, 0);
  if (d.getTime() > Date.now()) d.setTime(Date.now() - 3_600_000);
  return d.toISOString();
}

/**
 * Saldo disponible objetivo por material, diseñado contra los buffers:
 * 5 referencias POR DEBAJO de buffer_min (REPONER), 1 en EXCESO sobre
 * buffer_max (m-11) y el resto entre buffers (OK).
 */
const SALDO_OBJETIVO: Record<string, number> = {
  "m-01": 24, // REPONER (min 60)
  "m-02": 96,
  "m-03": 58,
  "m-04": 150,
  "m-05": 38, // REPONER (min 50)
  "m-06": 3, // REPONER (min 6)
  "m-07": 9,
  "m-08": 130, // REPONER (min 200)
  "m-09": 460,
  "m-10": 180,
  "m-11": 96, // EXCESO (max 80)
  "m-12": 210,
  "m-13": 4,
  "m-14": 28,
  "m-15": 12, // REPONER (min 25)
  "m-16": 20,
};

/** Reservas contra OPs en proceso (columna aparte, no afecta el kardex). */
const RESERVAS: Record<string, number> = {
  "m-01": 18,
  "m-02": 12,
  "m-04": 30,
  "m-05": 10,
  "m-06": 2,
  "m-08": 60,
  "m-09": 48,
  "m-11": 8,
  "m-15": 6,
};

/** 3 productos terminados en bodega (PRODUCTOS de ops.ts). */
const PT_SEED: Array<{
  producto_id: string;
  disponible: number;
  reservada: number;
}> = [
  { producto_id: "p-05", disponible: 6, reservada: 2 }, // Banco plano BF
  { producto_id: "p-07", disponible: 9, reservada: 3 }, // Barra olímpica
  { producto_id: "p-10", disponible: 14, reservada: 4 }, // J-Cups (par)
];

interface SeedInventario {
  existencias: Existencia[];
  movimientos: MovimientoInventario[];
}

function generarSeed(): SeedInventario {
  const existencias: Existencia[] = [];
  const movimientos: MovimientoInventario[] = [];
  let movId = 1;

  const mov = (
    existencia_id: string,
    tipo: MovimientoInventario["tipo"],
    cantidad: number,
    en: string,
    costo_unit: number | null = null,
    nota: string | null = null,
  ) => {
    movimientos.push({
      id: movId++,
      existencia_id,
      tipo,
      cantidad,
      costo_unit,
      op_id: null,
      recepcion_id: null,
      usuario_id: null,
      nota,
      en,
    });
  };

  MATERIALES.forEach((m, idx) => {
    const r = rng(idx + 7);
    const exId = `ex-mp-${String(idx + 1).padStart(2, "0")}`;
    const objetivo =
      SALDO_OBJETIVO[m.id] ??
      m.buffer_min + Math.round((m.buffer_max - m.buffer_min) / 2);

    existencias.push({
      id: exId,
      producto_id: null,
      material_id: m.id,
      tipo: "materia_prima",
      cantidad_disponible: objetivo,
      cantidad_reservada: RESERVAS[m.id] ?? 0,
    });

    // Carga inicial hace ~8 meses: 'ajuste' con costo (fija el promedio).
    let saldo = Math.max(1, Math.round(m.buffer_max * 0.5));
    mov(
      exId,
      "ajuste",
      saldo,
      tsMes(8, 2 + Math.floor(r() * 8)),
      m.costo_promedio,
      "Carga inicial de inventario",
    );

    // ~8 meses de compras y consumos coherentes (saldo nunca negativo).
    for (let k = 7; k >= 0; k--) {
      if (k === 7 || r() < 0.75) {
        const cant = Math.max(
          1,
          Math.round((m.buffer_max - m.buffer_min) * (0.35 + r() * 0.5)),
        );
        // costo alrededor del promedio ±5%
        const costo = Math.round(m.costo_promedio * (0.95 + r() * 0.1));
        mov(exId, "entrada_compra", cant, tsMes(k, 3 + Math.floor(r() * 10), 10), costo);
        saldo += cant;
      }
      const nSalidas = 1 + (r() < 0.5 ? 1 : 0);
      for (let s = 0; s < nSalidas; s++) {
        const deseo = Math.max(
          1,
          Math.round((m.buffer_max - m.buffer_min) * (0.15 + r() * 0.3)),
        );
        const cant = Math.min(deseo, saldo);
        if (cant <= 0) continue;
        mov(
          exId,
          "salida_produccion",
          -cant,
          tsMes(k, 14 + Math.floor(r() * 12), 15),
        );
        saldo -= cant;
      }
    }

    // Movimiento reciente que cuadra el kardex con el saldo objetivo.
    const diff = objetivo - saldo;
    if (diff > 0) {
      mov(
        exId,
        "entrada_compra",
        diff,
        tsMes(0, 28, 11),
        Math.round(m.costo_promedio * (0.97 + r() * 0.06)),
      );
    } else if (diff < 0) {
      mov(exId, "salida_produccion", diff, tsMes(0, 28, 16));
    }
  });

  PT_SEED.forEach((pt, idx) => {
    existencias.push({
      id: `ex-pt-${String(idx + 1).padStart(2, "0")}`,
      producto_id: pt.producto_id,
      material_id: null,
      tipo: "terminado",
      cantidad_disponible: pt.disponible,
      cantidad_reservada: pt.reservada,
    });
  });

  return { existencias, movimientos };
}

// ---------------------------------------------------------------
// Implementación mock (estado en memoria por instancia)
// ---------------------------------------------------------------

export class MockInventarioRepository implements InventarioRepository {
  private existencias: Existencia[];
  private movimientos: MovimientoInventario[];
  /** costo_promedio VIVO por material (en la BD lo mantiene el trigger). */
  private costos: Map<string, number>;

  constructor() {
    const seed = generarSeed();
    this.existencias = seed.existencias;
    this.movimientos = seed.movimientos;
    this.costos = new Map(MATERIALES.map((m) => [m.id, m.costo_promedio]));
  }

  private filaMP(ex: Existencia): ExistenciaMP {
    const material = MATERIALES.find((m) => m.id === ex.material_id);
    if (!material) throw new Error(`Material ${ex.material_id} no existe`);
    const tipo = TIPOS_MATERIAL.find((t) => t.id === material.tipo_material_id);
    if (!tipo) throw new Error(`Tipo de material ${material.tipo_material_id} no existe`);
    return {
      existencia: ex,
      material: { ...material, costo_promedio: this.costos.get(material.id)! },
      tipo,
    };
  }

  async listarExistenciasMP(
    filtros: FiltrosInventarioMP = {},
  ): Promise<ExistenciaMP[]> {
    const filas = this.existencias
      .filter((e) => e.tipo === "materia_prima" && e.material_id)
      .map((e) => this.filaMP(e));
    filas.sort(
      (a, b) =>
        a.tipo.id - b.tipo.id ||
        a.material.nombre.localeCompare(b.material.nombre, "es"),
    );
    return structuredClone(aplicarFiltrosInventario(filas, filtros));
  }

  async listarExistenciasPT(): Promise<ExistenciaPT[]> {
    const filas = this.existencias
      .filter((e) => e.tipo === "terminado" && e.producto_id)
      .map((e) => ({
        existencia: e,
        producto: PRODUCTOS.find((p) => p.id === e.producto_id)!,
      }))
      .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
    return structuredClone(filas);
  }

  async kardex(material_id: string): Promise<MovimientoInventario[]> {
    const ex = this.existencias.find((e) => e.material_id === material_id);
    if (!ex) return [];
    return structuredClone(
      this.movimientos
        .filter((m) => m.existencia_id === ex.id)
        .sort((a, b) => b.en.localeCompare(a.en) || b.id - a.id),
    );
  }

  async comprasMensuales(meses: number): Promise<CompraMensual[]> {
    const corte = new Date();
    corte.setDate(1);
    corte.setMonth(corte.getMonth() - (meses - 1));
    corte.setHours(0, 0, 0, 0);

    const acum = new Map<string, CompraMensual>();
    for (const m of this.movimientos) {
      if (m.tipo !== "entrada_compra") continue;
      const ex = this.existencias.find((e) => e.id === m.existencia_id);
      if (!ex?.material_id) continue;
      const fecha = new Date(m.en);
      if (fecha < corte) continue;
      const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      const clave = `${ex.material_id}|${mes}`;
      const fila = acum.get(clave) ?? {
        material_id: ex.material_id,
        mes,
        cantidad: 0,
        costo_total: 0,
      };
      fila.cantidad += m.cantidad;
      fila.costo_total += m.cantidad * (m.costo_unit ?? 0);
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
    const ex = this.existencias.find((e) => e.id === existencia_id);
    if (!ex) throw new Error(`La existencia ${existencia_id} no existe.`);
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      throw new Error("La cantidad del ajuste no puede ser cero.");
    }
    if (!nota.trim()) {
      throw new Error(
        "La nota es obligatoria: el kardex es inmutable y todo ajuste debe quedar explicado.",
      );
    }
    if (costo_unit !== undefined && (!Number.isFinite(costo_unit) || costo_unit <= 0)) {
      throw new Error("El costo unitario, si se indica, debe ser mayor que cero.");
    }

    const saldoPrevio = ex.cantidad_disponible;
    const nuevoSaldo = Math.round((saldoPrevio + cantidad) * 1000) / 1000;
    if (nuevoSaldo < 0) {
      throw new Error(
        `El ajuste dejaría el saldo en ${nuevoSaldo} y el inventario no admite negativos (disponible actual: ${saldoPrevio}).`,
      );
    }

    // Promedio ponderado — réplica de fn_aplicar_movimiento: solo entradas
    // con costo sobre materia prima; si el saldo previo no tenía costo,
    // el costo entrante ES el nuevo promedio.
    if (ex.material_id && costo_unit !== undefined && cantidad > 0) {
      const costoPrevio = this.costos.get(ex.material_id) ?? 0;
      const nuevoCosto =
        saldoPrevio <= 0 || costoPrevio === 0
          ? costo_unit
          : Math.round(
              ((saldoPrevio * costoPrevio + cantidad * costo_unit) /
                (saldoPrevio + cantidad)) *
                1e4,
            ) / 1e4;
      this.costos.set(ex.material_id, nuevoCosto);
    }

    ex.cantidad_disponible = nuevoSaldo;
    const movimiento: MovimientoInventario = {
      id: Math.max(0, ...this.movimientos.map((m) => m.id)) + 1,
      existencia_id,
      tipo: "ajuste",
      cantidad,
      costo_unit: costo_unit ?? null,
      op_id: null,
      recepcion_id: null,
      usuario_id: null,
      nota: nota.trim(),
      en: new Date().toISOString(),
    };
    this.movimientos.push(movimiento);
    return structuredClone(movimiento);
  }
}

// El factory `getInventarioRepository()` vive en `inventario-server.ts`
// (server-only): devuelve el repositorio Supabase real. Este módulo no
// importa el cliente Supabase para poder usarse desde el navegador.
