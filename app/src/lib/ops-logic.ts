/**
 * Lógica de negocio PURA de Órdenes de Pedido (sin React, sin I/O):
 * funciones deterministas y testeables que usan tanto el data layer
 * como los componentes de UI.
 */

import { semaforoEntrega } from "@/lib/formato";

/** Estados del semáforo de entrega. 'negro' = vencida sin entregar. */
export type SemaforoOp = "ninguno" | "amarillo" | "rojo" | "negro";

/** Parsea "YYYY-MM-DD" (o un ISO) como fecha LOCAL a medianoche. */
export function parseFechaLocal(fecha: string): Date {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Semáforo de una OP — SIEMPRE calculado, nunca almacenado.
 *   · sin color ('ninguno') si ya fue entregada o no tiene fecha pactada
 *   · 'ninguno'  → faltan más de 3 semanas (> 21 días)
 *   · 'amarillo' → 2–3 semanas (15–21 días)
 *   · 'rojo'     → 1–2 semanas o menos (0–14 días)
 *   · 'negro'    → vencida sin entregar (días < 0)
 */
export function semaforo(
  fecha_entrega_pactada: string | null,
  fecha_entregada: string | null,
  hoy: Date = new Date(),
): SemaforoOp {
  if (fecha_entregada || !fecha_entrega_pactada) return "ninguno";
  const s = semaforoEntrega(parseFechaLocal(fecha_entrega_pactada), hoy);
  return s === "vencido" ? "negro" : s;
}

/** Forma mínima de un ítem para decidir el producto principal. */
export interface ItemConProducto {
  precio_unit: number;
  producto: { nombre: string; es_rack: boolean };
}

/**
 * Producto principal de una OP: el que es_rack (el de mayor precio si hay
 * varios racks); si ninguno es rack, el de mayor precio_unit.
 */
export function productoPrincipal<T extends ItemConProducto>(
  items: T[],
): T | null {
  if (items.length === 0) return null;
  const porPrecio = (a: T, b: T) => b.precio_unit - a.precio_unit;
  const racks = items.filter((i) => i.producto.es_rack).sort(porPrecio);
  return racks[0] ?? [...items].sort(porPrecio)[0];
}

/** Forma mínima de un ítem para calcular el avance de entrega. */
export interface ItemEntregable {
  cantidad: number;
  cantidad_entregada: number;
}

/** % despachado de la OP (0–100, redondeado) ponderado por unidades. */
export function progresoEntrega(items: ItemEntregable[]): number {
  const total = items.reduce((s, i) => s + i.cantidad, 0);
  if (total === 0) return 0;
  const entregado = items.reduce((s, i) => s + i.cantidad_entregada, 0);
  return Math.round((entregado / total) * 100);
}

/** Valor total de la OP: Σ cantidad × precio_unit. */
export function totalOp(
  items: { cantidad: number; precio_unit: number }[],
): number {
  return items.reduce((s, i) => s + i.cantidad * i.precio_unit, 0);
}

/**
 * Orden de tarjetas tipo "ambulancia": las garantías SIEMPRE primero,
 * después las OP por fecha de entrega pactada ascendente (sin fecha al final).
 */
export function ordenarTarjetas<
  T extends { tipo: "op" | "garantia"; fecha_entrega_pactada: string | null },
>(tarjetas: T[]): T[] {
  return [...tarjetas].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "garantia" ? -1 : 1;
    if (a.fecha_entrega_pactada === b.fecha_entrega_pactada) return 0;
    if (a.fecha_entrega_pactada === null) return 1;
    if (b.fecha_entrega_pactada === null) return -1;
    return a.fecha_entrega_pactada < b.fecha_entrega_pactada ? -1 : 1;
  });
}
