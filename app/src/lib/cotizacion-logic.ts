/**
 * Lógica pura de cotizaciones — espejo de las reglas del Planner y del
 * esquema SQL. Sin dependencias de UI ni de datos: todo testeable.
 *
 * Reglas de negocio:
 *  · Los precios se manejan CON IVA (19%) incluido; subtotal = total / 1.19.
 *  · Ítems con aplica_iva=false (típicamente transporte) no desglosan IVA.
 *  · Descuento 0–50% SOLO con pago anticipado completo; se aplica sobre el
 *    total bruto ANTES de desglosar el IVA (regla del Planner).
 *  · Términos de pago: productos 'propio' (PP) 60% anticipo + 40% antes de
 *    entrega; 'comercializado' (PC) 100% anticipado. UNA factura, dos pagos.
 *  · Ítems libres (transporte, servicios) se agrupan con PP si la cotización
 *    tiene productos propios; si es 100% comercializada, con PC.
 */

import type {
  Cotizacion,
  CotizacionItem,
  Producto,
  RecargoAplicado,
} from "@/lib/types/db";

export const IVA_RATE = 0.19;
export const ANTICIPO_PP = 0.6; // 60% anticipo, 40% antes de entrega
export const VALIDEZ_DIAS = 15;

export interface CotizacionItemConProducto extends CotizacionItem {
  producto: Producto | null; // null en ítems libres (transporte…)
}

export interface TotalesCotizacion {
  bruto: number; // Σ cantidad·precio antes de descuento (CON IVA donde aplique)
  descuentoPct: number; // efectivo (0 si no hay pago anticipado completo)
  descuentoMonto: number;
  subtotal: number; // sin IVA (incluye ítems exentos a valor pleno)
  iva: number;
  total: number; // lo que paga el cliente
  totalPP: number; // grupo fabricación propia (post-descuento)
  totalPC: number; // grupo comercializados (post-descuento)
  pagoInicial: number; // 60%·PP + 100%·PC (o total si pago anticipado)
  saldo: number; // total - pagoInicial (se paga ANTES de la entrega)
  unidades: number;
  lineas: number;
}

/** Grupo de pago de un ítem: PP (propio) o PC (comercializado). */
export function grupoDeItem(
  item: CotizacionItemConProducto,
  hayPropios: boolean,
): "PP" | "PC" {
  if (item.producto) return item.producto.origen === "comercializado" ? "PC" : "PP";
  return hayPropios ? "PP" : "PC"; // ítems libres siguen al grupo dominante
}

/** Sobreprecio unitario por cm extra sobre el default (CON IVA). */
export function sobreprecioPorCm(
  defaultCm: number | null,
  overrideCm: number | null,
  precioPorCmExtra: number,
): number {
  if (defaultCm === null || overrideCm === null) return 0;
  return Math.max(0, overrideCm - defaultCm) * precioPorCmExtra;
}

/** Monto unitario de una lista de recargos sobre un precio base CON IVA. */
export function montoRecargos(base: number, recargos: RecargoAplicado[]): number {
  return recargos.reduce(
    (acc, r) => acc + (r.tipo === "pct" ? Math.round((base * r.valor) / 100) : r.valor),
    0,
  );
}

export function calcularTotales(
  items: CotizacionItemConProducto[],
  cot: Pick<Cotizacion, "descuento_pct" | "pago_anticipado_completo">,
): TotalesCotizacion {
  const linea = (i: CotizacionItem) => Math.round(i.cantidad * i.precio_unit);
  const bruto = items.reduce((a, i) => a + linea(i), 0);

  // descuento solo con pago anticipado completo (regla del Planner)
  const descuentoPct = cot.pago_anticipado_completo ? cot.descuento_pct : 0;
  const descuentoMonto = Math.round((bruto * descuentoPct) / 100);
  const factor = bruto > 0 ? (bruto - descuentoMonto) / bruto : 1;

  const conIva = Math.round(
    items.filter((i) => i.aplica_iva).reduce((a, i) => a + linea(i), 0) * factor,
  );
  const sinIva = Math.round(
    items.filter((i) => !i.aplica_iva).reduce((a, i) => a + linea(i), 0) * factor,
  );
  const baseGravada = Math.round(conIva / (1 + IVA_RATE));
  const iva = conIva - baseGravada;
  const total = conIva + sinIva;

  const hayPropios = items.some(
    (i) => i.producto && i.producto.origen === "propio",
  );
  const totalPP = Math.round(
    items
      .filter((i) => grupoDeItem(i, hayPropios) === "PP")
      .reduce((a, i) => a + linea(i), 0) * factor,
  );
  const totalPC = total - totalPP;

  const pagoInicial = cot.pago_anticipado_completo
    ? total
    : Math.round(ANTICIPO_PP * totalPP) + totalPC;

  return {
    bruto,
    descuentoPct,
    descuentoMonto,
    subtotal: baseGravada + sinIva,
    iva,
    total,
    totalPP,
    totalPC,
    pagoInicial,
    saldo: total - pagoInicial,
    unidades: items.reduce((a, i) => a + i.cantidad, 0),
    lineas: items.length,
  };
}

/**
 * Vencida = pasó valida_hasta sin estar Aprobada ni Anulada.
 * (El estado 'Vencida' también puede fijarse manualmente; esta función
 * cubre las que quedaron en Borrador/Enviada y expiraron.)
 */
export function estaVencida(
  cot: Pick<Cotizacion, "valida_hasta">,
  nombreEstado: string,
  hoy: Date = new Date(),
): boolean {
  if (nombreEstado === "Aprobada" || nombreEstado === "Anulada") return false;
  if (nombreEstado === "Vencida") return true;
  const [y, m, d] = cot.valida_hasta.split("-").map(Number);
  const limite = new Date(y, m - 1, d, 23, 59, 59);
  return hoy > limite;
}

/** Días (enteros, mínimo 0) que la oportunidad lleva en su etapa actual. */
export function diasEnEtapa(movida_en: string, hoy: Date = new Date()): number {
  const dias = Math.floor(
    (hoy.getTime() - new Date(movida_en).getTime()) / 86_400_000,
  );
  return Math.max(0, dias);
}

/*
 * Tests inline (verificados manualmente):
 *  calcularTotales con 1 ítem PP $1.190.000 ×1 y transporte $100.000 sin IVA:
 *   bruto=1.290.000 · subtotal=1.000.000+100.000=1.100.000 · iva=190.000
 *   total=1.290.000 · totalPP=1.290.000 (transporte sigue a PP)
 *   pagoInicial=774.000 (60%) · saldo=516.000
 *  Con pago_anticipado_completo y descuento 5%:
 *   descuentoMonto=64.500 · total=1.225.500 · pagoInicial=1.225.500 · saldo=0
 */
