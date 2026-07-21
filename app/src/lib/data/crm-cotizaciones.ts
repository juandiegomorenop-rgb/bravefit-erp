/**
 * Data layer de Ventas (CRM + Cotizaciones) — INTERCAMBIABLE.
 *
 * Igual patrón que ops.ts: la UI solo conoce las interfaces y los
 * factories. CRM y Cotizaciones comparten un store en memoria (una
 * oportunidad apunta a su cotización), y al GANAR una oportunidad se
 * crea la OP en el repositorio de Órdenes: aparece de inmediato en el
 * kanban de Producción (réplica de fn_validar_ganada + OP automática).
 */

import {
  calcularTotales,
  estaVencida,
  type CotizacionItemConProducto,
  type TotalesCotizacion,
} from "@/lib/cotizacion-logic";
import {
  CIUDADES,
  CLIENTES,
  fechaRel,
  getOpsRepository,
  PRODUCTOS,
  tsRel,
  USUARIOS,
} from "@/lib/data/ops";
import { parseFechaLocal } from "@/lib/ops-logic";
import type {
  Ciudad,
  Cliente,
  Cotizacion,
  CotizacionItem,
  EstadoCotizacion,
  EtapaCrm,
  Oportunidad,
  Usuario,
} from "@/lib/types/db";

// ---------------------------------------------------------------
// Tipos enriquecidos (joins) que consume la UI
// ---------------------------------------------------------------

export interface OportunidadCard {
  oportunidad: Oportunidad;
  cliente: Cliente;
  vendedor: Usuario;
  /** Resumen de la cotización vinculada (null si aún no hay). */
  cotizacion: {
    id: string;
    numero: string;
    estado: string;
    total: number;
    tiene_items: boolean;
  } | null;
  /** Valor a mostrar: total de la cotización o valor_estimado. */
  valor: number;
  /** OP generada al ganar (si existe): la ficha enlaza a Producción. */
  op?: { id: string; numero: string } | null;
}

export interface ResultadoMoverCrm {
  /** Presente solo cuando la etapa destino es_ganada: la OP generada. */
  opCreada?: { id: string; numero: string };
}

export interface FiltrosCrm {
  vendedor_id?: string;
  texto?: string;
}

/** Alta manual de una tarjeta al embudo (lead que aún no tiene cotización). */
export interface OportunidadNuevaInput {
  cliente_id: string;
  vendedor_id: string;
  valor_estimado: number | null;
  notas: string | null;
}

export interface CrmRepository {
  listarOportunidades(filtros?: FiltrosCrm): Promise<OportunidadCard[]>;
  /** Crea la oportunidad en la PRIMERA etapa del embudo (En conversaciones). */
  crearOportunidad(input: OportunidadNuevaInput): Promise<void>;
  /**
   * Descarta la ficha del embudo (creada por error o de prueba): la
   * saca del tablero sin borrarla de la BD. NO es lo mismo que
   * Perdido — eso es un cierre real y sí cuenta en el embudo.
   */
  descartarOportunidad(id: string): Promise<void>;
  /**
   * Mueve la ficha de etapa. Si la etapa destino es_ganada, EXIGE
   * cotización con ítems (si no, lanza Error con mensaje claro) y crea
   * la OP automática en "En Cola" con origen 'cotizacion'.
   */
  moverEtapa(oportunidad_id: string, etapa_id: number): Promise<ResultadoMoverCrm>;
  listarEtapas(): Promise<EtapaCrm[]>;
  listarVendedores(): Promise<Usuario[]>;
}

export interface CotizacionCard {
  cotizacion: Cotizacion;
  cliente: Cliente;
  vendedor: Usuario;
  estado: EstadoCotizacion;
  total: number;
  vencida: boolean;
}

export interface CotizacionDetalle {
  cotizacion: Cotizacion;
  cliente: Cliente;
  ciudad: Ciudad | null;
  vendedor: Usuario;
  estado: EstadoCotizacion;
  items: CotizacionItemConProducto[];
  totales: TotalesCotizacion;
  vencida: boolean;
  /** Oportunidad CRM vinculada, si existe. */
  oportunidad_id: string | null;
}

export interface FiltrosCotizaciones {
  estado_id?: number;
  vendedor_id?: string;
  segmento?: "B2B" | "B2C";
  texto?: string;
}

/** Ítem del editor (sin ids: el repo los asigna). */
export interface CotizacionItemInput {
  producto_id: string | null;
  descripcion: string | null;
  es_transporte: boolean;
  aplica_iva: boolean;
  cantidad: number;
  precio_unit: number;
  descuento_pct: number;
  alto_override_cm: number | null;
  fondo_override_cm: number | null;
  color: string | null;
  recargos: CotizacionItem["recargos"];
}

export interface CotizacionInput {
  cliente_id: string;
  vendedor_id: string;
  /** Fuente del lead → sigla del número (WA, SR, SPFY, BFP). */
  origen?: Cotizacion["origen"];
  segmento: "B2B" | "B2C";
  no_facturar: boolean;
  pago_anticipado_completo: boolean;
  descuento_pct: number; // global, solo con pago anticipado
  tiempo_entrega: string | null;
  notas: string | null;
  items: CotizacionItemInput[];
}

export interface CotizacionesRepository {
  listar(filtros?: FiltrosCotizaciones): Promise<CotizacionCard[]>;
  obtener(id: string): Promise<CotizacionDetalle | null>;
  /**
   * Crea en estado Borrador con el siguiente número de la serie.
   * `oportunidadId`: si viene, la cotización se vincula a ESA
   * oportunidad del embudo; si no, nace una tarjeta nueva.
   */
  crear(
    input: CotizacionInput,
    oportunidadId?: string,
  ): Promise<{ id: string; numero: string }>;
  /** Solo borradores: reemplaza cabecera e ítems completos. */
  actualizar(id: string, input: CotizacionInput): Promise<void>;
  /** Borrador → Enviada (el documento queda listo para el cliente). */
  marcarEnviada(id: string): Promise<void>;
  /**
   * Borrador/Enviada/Vencida → Anulada. Aprobadas NO se anulan (ya
   * generaron OP). Si la cotización tenía oportunidad viva en el
   * embudo CRM, la oportunidad pasa a Perdido automáticamente.
   */
  anular(id: string): Promise<void>;
  /**
   * Crea un Borrador NUEVO (número nuevo) copiando cliente, condiciones
   * e ítems de la cotización dada — para re-cotizar vencidas o hacer
   * variantes sin rearmar. Funciona desde cualquier estado.
   */
  duplicar(id: string): Promise<{ id: string; numero: string }>;
  listarClientes(): Promise<Cliente[]>;
  listarEstados(): Promise<EstadoCotizacion[]>;
  listarVendedores(): Promise<Usuario[]>;
}

// ===============================================================
// Archivo (patrón de esOpArchivada en ops.ts)
// ===============================================================

export const ARCHIVO_DIAS_COTIZACION = 30;

/** Días que una oportunidad cerrada (Ganado/Perdido) sigue visible en
 *  el embudo antes de pasar al Archivo del CRM. */
export const ARCHIVO_DIAS_CRM = 7;

/**
 * Datos que le faltan al cliente para poder COTIZAR (regla de Juan
 * 20-jul-2026). Persona: nombres y apellidos, cédula, celular, correo
 * y ciudad. Empresa: razón social, NIT, correo y ciudad. La DIRECCIÓN
 * no se pide aquí: se exige al ganar (envío + factura) — ver
 * `faltaDireccionParaGanar`.
 */
export function faltantesParaCotizar(c: Cliente): string[] {
  const esEmpresa = c.tipo === "empresa";
  const falta: string[] = [];
  if (!c.nombre?.trim())
    falta.push(esEmpresa ? "Razón social" : "Nombres y apellidos");
  if (!c.nit_cedula?.trim()) falta.push(esEmpresa ? "NIT" : "Cédula");
  if (!esEmpresa && !c.telefono?.trim()) falta.push("Celular");
  if (!c.email?.trim()) falta.push("Correo electrónico");
  if (c.ciudad_id == null) falta.push("Ciudad");
  return falta;
}

/** La factura y el envío exigen dirección: se pide al GANAR. */
export function faltaDireccionParaGanar(c: Cliente): boolean {
  return !c.direccion?.trim();
}

/** Vendedor preseleccionado en cotizaciones y oportunidades nuevas
 *  (regla de Juan: siempre Yohan; cambiar el nombre aquí si cambia
 *  el comercial de cabecera). */
const VENDEDOR_POR_DEFECTO = "yohan";
export function vendedorPorDefecto(vendedores: Usuario[]): string {
  return (
    vendedores.find((v) =>
      v.nombre.toLowerCase().includes(VENDEDOR_POR_DEFECTO),
    )?.id ??
    vendedores[0]?.id ??
    ""
  );
}

/**
 * Una oportunidad sale del embudo activo cuando ya cerró (Ganado —su OP
 * vive en Producción— o Perdido) hace más de ARCHIVO_DIAS_CRM días.
 * Las cerradas recientes se quedan a la vista para el corte semanal.
 */
export function esOportunidadArchivada(
  card: OportunidadCard,
  etapas: EtapaCrm[],
  hoy = new Date(),
): boolean {
  const etapa = etapas.find((e) => e.id === card.oportunidad.etapa_id);
  if (!etapa || (!etapa.es_ganada && !etapa.es_perdida)) return false;
  const cerrada = new Date(card.oportunidad.movida_en);
  return (hoy.getTime() - cerrada.getTime()) / 86_400_000 > ARCHIVO_DIAS_CRM;
}

/**
 * Una cotización sale del listado activo cuando ya es historia
 * (reglas de Juan, 19-jul-2026):
 *   · Anulada o Aprobada → al Archivo de inmediato. La Aprobada ya
 *     cumplió su ciclo: su OP vive en Producción.
 *   · Vencida sin aprobar (Borrador/Enviada con validez pasada) → al
 *     Archivo 30 días después de `valida_hasta`: ventana amplia para
 *     hacerle seguimiento comercial antes de que se guarde sola.
 */
export function esCotizacionArchivada(card: CotizacionCard, hoy = new Date()): boolean {
  const nombre = card.estado.nombre;
  if (nombre === "Anulada" || nombre === "Aprobada") return true;
  if (!card.vencida) return false;
  const corte = parseFechaLocal(card.cotizacion.valida_hasta);
  corte.setDate(corte.getDate() + ARCHIVO_DIAS_COTIZACION);
  return hoy > corte;
}

// ===============================================================
// MOCK — catálogos espejo de seed.sql
// ===============================================================

const ETAPAS_CRM: EtapaCrm[] = [
  { id: 1, nombre: "En conversaciones", orden: 1, color: "#5a5a5a", es_ganada: false, es_perdida: false, activo: true },
  { id: 2, nombre: "Elaborando Cotización y/o Render", orden: 2, color: "#a06d10", es_ganada: false, es_perdida: false, activo: true },
  { id: 3, nombre: "Cotizado", orden: 3, color: "#3b5bb5", es_ganada: false, es_perdida: false, activo: true },
  { id: 4, nombre: "Ganado", orden: 4, color: "#1a7f4e", es_ganada: true, es_perdida: false, activo: true },
  { id: 5, nombre: "Perdido", orden: 5, color: "#c2410c", es_ganada: false, es_perdida: true, activo: true },
];

const ESTADOS: EstadoCotizacion[] = [
  { id: 1, nombre: "Borrador", orden: 1, activo: true },
  { id: 2, nombre: "Enviada", orden: 2, activo: true },
  { id: 3, nombre: "Aprobada", orden: 3, activo: true },
  { id: 4, nombre: "Vencida", orden: 4, activo: true },
  { id: 5, nombre: "Anulada", orden: 5, activo: true },
];

// Los vendedores son los usuarios Administradores (venden); Ops1/Ops2 no
export const VENDEDORES: Usuario[] = USUARIOS.filter((u) => u.rol_id === 1);

// ---------------------------------------------------------------
// MOCK — cotizaciones (numeración continúa la serie del Planner)
// ---------------------------------------------------------------

interface CotSeed {
  id: string;
  numero: string;
  cliente_id: string;
  vendedor_id: string;
  segmento: "B2B" | "B2C";
  estado_id: number;
  creada: number; // días relativos a hoy
  no_facturar?: boolean;
  descuento_pct?: number;
  pago_anticipado_completo?: boolean;
  tiempo_entrega?: string;
  origen?: "manual" | "chat" | "planner";
  notas?: string;
}

function cotSeed(s: CotSeed): Cotizacion {
  return {
    id: s.id,
    numero: s.numero,
    cliente_id: s.cliente_id,
    vendedor_id: s.vendedor_id,
    segmento: s.segmento,
    estado_id: s.estado_id,
    no_facturar: s.no_facturar ?? false,
    descuento_pct: s.descuento_pct ?? 0,
    pago_anticipado_completo: s.pago_anticipado_completo ?? false,
    valida_hasta: fechaRel(s.creada + 15), // regla: creación + 15 días
    tiempo_entrega: s.tiempo_entrega ?? null,
    origen: s.origen ?? "manual",
    notas: s.notas ?? null,
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(s.creada, 10),
  };
}

const COTIZACIONES: Cotizacion[] = [
  cotSeed({ id: "q-01", numero: "BFP-0106", cliente_id: "c-01", vendedor_id: "u-01", segmento: "B2B", estado_id: 2, creada: -5, tiempo_entrega: "Fabricados: 45 días hábiles", notas: "Segunda sede El Poblado. Incluye transporte a obra. El cliente ya cuenta con piso de caucho." }),
  cotSeed({ id: "q-02", numero: "BFP-0107", cliente_id: "c-05", vendedor_id: "u-02", segmento: "B2B", estado_id: 3, creada: -20, pago_anticipado_completo: true, descuento_pct: 5, tiempo_entrega: "Fabricados: 45 días hábiles · Comercializados: 3 a 7 días hábiles", notas: "Cliente pagó 100% anticipado — descuento 5% aplicado." }),
  cotSeed({ id: "q-03", numero: "BFP-0108", cliente_id: "c-03", vendedor_id: "u-01", segmento: "B2C", estado_id: 1, creada: -2, origen: "planner", tiempo_entrega: "30 días hábiles", notas: "Diseño hecho en el Planner. Rack en dorado (color no estándar)." }),
  cotSeed({ id: "q-04", numero: "BFP-0109", cliente_id: "c-04", vendedor_id: "u-03", segmento: "B2B", estado_id: 2, creada: -18, tiempo_entrega: "Fabricados: 45 días hábiles", notas: "Gimnasio del hotel, piso 12. Descuento del 10% en jaulas por volumen." }),
  cotSeed({ id: "q-05", numero: "BFP-0110", cliente_id: "c-08", vendedor_id: "u-02", segmento: "B2B", estado_id: 4, creada: -40 }),
  cotSeed({ id: "q-06", numero: "BFP-0111", cliente_id: "c-10", vendedor_id: "u-01", segmento: "B2C", estado_id: 3, creada: -9, no_facturar: true, notas: "Venta mostrador — no facturar en Siigo." }),
  cotSeed({ id: "q-07", numero: "BFP-0112", cliente_id: "c-02", vendedor_id: "u-03", segmento: "B2B", estado_id: 2, creada: -12, tiempo_entrega: "Fabricados: 45 días hábiles · Comercializados: 3 a 7 días hábiles", notas: "Ampliación del box. Rig anclado a losa." }),
  cotSeed({ id: "q-08", numero: "BFP-0113", cliente_id: "c-13", vendedor_id: "u-02", segmento: "B2B", estado_id: 1, creada: -5, notas: "Pendiente definir equipos con el administrador del edificio." }),
  cotSeed({ id: "q-09", numero: "BFP-0114", cliente_id: "c-09", vendedor_id: "u-01", segmento: "B2B", estado_id: 5, creada: -30, notas: "Anulada: el cliente pospuso el proyecto para 2027." }),
  cotSeed({ id: "q-10", numero: "BFP-0115", cliente_id: "c-15", vendedor_id: "u-03", segmento: "B2B", estado_id: 2, creada: -8 }),
  cotSeed({ id: "q-11", numero: "BFP-0116", cliente_id: "c-14", vendedor_id: "u-01", segmento: "B2C", estado_id: 3, creada: -3, origen: "chat", tiempo_entrega: "Comercializados: 3 a 7 días hábiles", notas: "Solicitada por el chat del ERP." }),
];

function cotItem(
  id: string,
  cotizacion_id: string,
  producto_id: string | null,
  cantidad: number,
  extra: Partial<CotizacionItem> = {},
): CotizacionItem {
  const producto = PRODUCTOS.find((p) => p.id === producto_id);
  return {
    id,
    cotizacion_id,
    producto_id,
    descripcion: null,
    es_transporte: false,
    aplica_iva: true,
    cantidad,
    precio_unit: producto?.precio_lista ?? 0,
    descuento_pct: 0,
    alto_override_cm: null,
    fondo_override_cm: null,
    color: null,
    recargos: [],
    ...extra,
  };
}

const COT_ITEMS: CotizacionItem[] = [
  // q-01: SmartFit — racks Pro + bancos + transporte SIN IVA
  cotItem("qi-01a", "q-01", "p-02", 4),
  cotItem("qi-01b", "q-01", "p-05", 8),
  cotItem("qi-01c", "q-01", null, 1, { descripcion: "Transporte Medellín — El Poblado (a obra)", es_transporte: true, aplica_iva: false, precio_unit: 450_000 }),
  // q-02: Gym House — rig (PP) + discos (PC), pago anticipado con 5%
  cotItem("qi-02a", "q-02", "p-03", 1),
  cotItem("qi-02b", "q-02", "p-08", 2),
  // q-03: Laura — Rack PF5 alto 250 (default 230: +20cm×$4.000) + color dorado (ATO 8%)
  cotItem("qi-03a", "q-03", "p-01", 1, {
    alto_override_cm: 250,
    color: "Dorado",
    precio_unit: 4_611_600, // 4.190.000 + 80.000 (cm extra) + 8% ATO (341.600)
    recargos: [
      { recargo_id: null, nombre: "Alto 250 cm (+20 cm × $4.000)", tipo: "fijo", valor: 80_000, monto: 80_000 },
      { recargo_id: 1, nombre: "Color no estándar (ATO)", tipo: "pct", valor: 8, monto: 341_600 },
    ],
  }),
  // q-04: Hotel Dann — jaulas con 10% DESC por volumen (formato: lista
  // tachada → % DESC → subtotal) + prensa + bancos ajustables
  cotItem("qi-04a", "q-04", "p-09", 2, { descuento_pct: 10 }),
  cotItem("qi-04b", "q-04", "p-11", 1),
  cotItem("qi-04c", "q-04", "p-06", 4),
  // q-05: Bodyfit 80 — racks de pared (vencida)
  cotItem("qi-05a", "q-05", "p-04", 6),
  // q-06: Marcela — banco ajustable (no facturar)
  cotItem("qi-06a", "q-06", "p-06", 1),
  // q-07: CrossFit Jungle — rig + discos + kit mancuernas + transporte CON IVA
  cotItem("qi-07a", "q-07", "p-03", 1),
  cotItem("qi-07b", "q-07", "p-08", 3),
  cotItem("qi-07c", "q-07", "p-12", 1),
  cotItem("qi-07d", "q-07", null, 1, { descripcion: "Transporte Envigado + izaje", es_transporte: true, aplica_iva: true, precio_unit: 380_000 }),
  // q-08: Torre GNB — BORRADOR SIN ÍTEMS (demo de la regla de Ganado)
  // q-09: CrossFit La Ceja — jaula (anulada)
  cotItem("qi-09a", "q-09", "p-09", 1),
  // q-10: Studio Pilates — racks de pared + bancos
  cotItem("qi-10a", "q-10", "p-04", 2),
  cotItem("qi-10b", "q-10", "p-05", 4),
  // q-11: Pedro — SOLO comercializados (PC 100% anticipado)
  cotItem("qi-11a", "q-11", "p-07", 1),
  cotItem("qi-11b", "q-11", "p-08", 1),
];

// ---------------------------------------------------------------
// MOCK — oportunidades CRM
// ---------------------------------------------------------------

interface OppSeed {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  etapa_id: number;
  cotizacion_id?: string;
  valor_estimado?: number;
  creada: number;
  movida: number;
  notas?: string;
}

function oppSeed(s: OppSeed): Oportunidad {
  return {
    id: s.id,
    cliente_id: s.cliente_id,
    cotizacion_id: s.cotizacion_id ?? null,
    etapa_id: s.etapa_id,
    vendedor_id: s.vendedor_id,
    valor_estimado: s.valor_estimado ?? null,
    notas: s.notas ?? null,
    movida_en: tsRel(s.movida, 11),
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(s.creada, 9),
  };
}

const OPORTUNIDADES: Oportunidad[] = [
  oppSeed({ id: "o-01", cliente_id: "c-07", vendedor_id: "u-01", etapa_id: 1, valor_estimado: 12_000_000, creada: -3, movida: -3, notas: "Coliseo del colegio: 2 racks de pared + zona funcional." }),
  oppSeed({ id: "o-02", cliente_id: "c-11", vendedor_id: "u-03", etapa_id: 1, valor_estimado: 45_000_000, creada: -8, movida: -8, notas: "Dotación completa para el gimnasio del coliseo." }),
  oppSeed({ id: "o-03", cliente_id: "c-06", vendedor_id: "u-02", etapa_id: 1, valor_estimado: 3_500_000, creada: -1, movida: -1 }),
  oppSeed({ id: "o-04", cliente_id: "c-12", vendedor_id: "u-02", etapa_id: 2, valor_estimado: 18_000_000, creada: -10, movida: -6, notas: "Esperando render del área outdoor." }),
  oppSeed({ id: "o-05", cliente_id: "c-03", vendedor_id: "u-01", etapa_id: 2, cotizacion_id: "q-03", creada: -4, movida: -2, notas: "Rack dorado del Planner — falta confirmar medidas del techo." }),
  oppSeed({ id: "o-06", cliente_id: "c-13", vendedor_id: "u-02", etapa_id: 2, cotizacion_id: "q-08", valor_estimado: 25_000_000, creada: -7, movida: -5, notas: "Cotización en borrador: definir equipos con el administrador." }),
  oppSeed({ id: "o-07", cliente_id: "c-01", vendedor_id: "u-01", etapa_id: 3, cotizacion_id: "q-01", creada: -6, movida: -4 }),
  oppSeed({ id: "o-08", cliente_id: "c-02", vendedor_id: "u-03", etapa_id: 3, cotizacion_id: "q-07", creada: -14, movida: -12, notas: "Revisan presupuesto con los socios." }),
  oppSeed({ id: "o-09", cliente_id: "c-15", vendedor_id: "u-03", etapa_id: 3, cotizacion_id: "q-10", creada: -22, movida: -20, notas: "Sin respuesta hace 3 semanas — hacer seguimiento." }),
  oppSeed({ id: "o-10", cliente_id: "c-05", vendedor_id: "u-02", etapa_id: 4, cotizacion_id: "q-02", creada: -25, movida: -15, notas: "Pagó 100% anticipado. OP generada." }),
  oppSeed({ id: "o-11", cliente_id: "c-14", vendedor_id: "u-01", etapa_id: 4, cotizacion_id: "q-11", creada: -5, movida: -2 }),
  oppSeed({ id: "o-12", cliente_id: "c-04", vendedor_id: "u-03", etapa_id: 5, cotizacion_id: "q-04", creada: -20, movida: -1, notas: "Eligieron proveedor importado por precio." }),
];

// ---------------------------------------------------------------
// Store compartido CRM ↔ Cotizaciones (una sola verdad en memoria)
// ---------------------------------------------------------------

interface VentasStore {
  cotizaciones: Cotizacion[];
  items: CotizacionItem[];
  oportunidades: Oportunidad[];
}

const globalVentas = globalThis as unknown as {
  __ventasStore?: VentasStore;
  __crmRepositorio?: CrmRepository;
  __cotRepositorio?: CotizacionesRepository;
};

function getStore(): VentasStore {
  globalVentas.__ventasStore ??= {
    cotizaciones: structuredClone(COTIZACIONES),
    items: structuredClone(COT_ITEMS),
    oportunidades: structuredClone(OPORTUNIDADES),
  };
  return globalVentas.__ventasStore;
}

function itemsDeCotizacion(store: VentasStore, cotizacion_id: string): CotizacionItemConProducto[] {
  return store.items
    .filter((i) => i.cotizacion_id === cotizacion_id)
    .map((i) => ({
      ...i,
      producto: PRODUCTOS.find((p) => p.id === i.producto_id) ?? null,
    }));
}

function totalDeCotizacion(store: VentasStore, cot: Cotizacion): number {
  return calcularTotales(itemsDeCotizacion(store, cot.id), cot).total;
}

// ---------------------------------------------------------------
// Implementaciones mock
// ---------------------------------------------------------------

export class MockCrmRepository implements CrmRepository {
  private get store() {
    return getStore();
  }

  private card(o: Oportunidad): OportunidadCard {
    const cot = o.cotizacion_id
      ? this.store.cotizaciones.find((c) => c.id === o.cotizacion_id)
      : undefined;
    const items = cot ? itemsDeCotizacion(this.store, cot.id) : [];
    const total = cot ? calcularTotales(items, cot).total : 0;
    return {
      oportunidad: structuredClone(o),
      cliente: CLIENTES.find((c) => c.id === o.cliente_id)!,
      vendedor: VENDEDORES.find((v) => v.id === o.vendedor_id)!,
      cotizacion: cot
        ? {
            id: cot.id,
            numero: cot.numero,
            estado: ESTADOS.find((e) => e.id === cot.estado_id)!.nombre,
            total,
            tiene_items: items.length > 0,
          }
        : null,
      valor: cot && items.length > 0 ? total : (o.valor_estimado ?? 0),
    };
  }

  async listarOportunidades(filtros: FiltrosCrm = {}): Promise<OportunidadCard[]> {
    const q = filtros.texto?.trim().toLowerCase();
    return this.store.oportunidades
      .filter((o) => o.activo)
      .map((o) => this.card(o))
      .filter((c) => {
        if (filtros.vendedor_id && c.vendedor.id !== filtros.vendedor_id) return false;
        if (q) {
          const blob = [c.cliente.nombre, c.cotizacion?.numero ?? "", c.oportunidad.notas ?? ""]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.valor - a.valor);
  }

  async crearOportunidad(input: OportunidadNuevaInput): Promise<void> {
    if (!input.cliente_id) throw new Error("Seleccione el cliente");
    if (!input.vendedor_id) throw new Error("Seleccione el vendedor");
    const inicial = ETAPAS_CRM.find((e) => !e.es_ganada && !e.es_perdida)!;
    this.store.oportunidades.push({
      id: `opo-${crypto.randomUUID().slice(0, 8)}`,
      cliente_id: input.cliente_id,
      cotizacion_id: null,
      etapa_id: inicial.id,
      vendedor_id: input.vendedor_id,
      valor_estimado: input.valor_estimado,
      notas: input.notas,
      movida_en: tsRel(0),
      activo: true,
      eliminado_en: null,
      creado_en: tsRel(0),
    });
  }

  async descartarOportunidad(id: string): Promise<void> {
    const o = this.store.oportunidades.find((x) => x.id === id && x.activo);
    if (!o) throw new Error("La oportunidad no existe o ya fue descartada");
    o.activo = false;
    o.eliminado_en = tsRel(0);
  }

  async moverEtapa(oportunidad_id: string, etapa_id: number): Promise<ResultadoMoverCrm> {
    const o = this.store.oportunidades.find((x) => x.id === oportunidad_id);
    if (!o) throw new Error(`Oportunidad ${oportunidad_id} no existe`);
    const etapa = ETAPAS_CRM.find((e) => e.id === etapa_id);
    if (!etapa) throw new Error(`Etapa CRM ${etapa_id} no existe`);

    if (!etapa.es_ganada) {
      o.etapa_id = etapa_id;
      o.movida_en = new Date().toISOString();
      return {};
    }

    // Réplica de fn_validar_ganada: Ganado exige cotización con ítems
    const cot = o.cotizacion_id
      ? this.store.cotizaciones.find((c) => c.id === o.cotizacion_id)
      : undefined;
    const items = cot ? itemsDeCotizacion(this.store, cot.id) : [];
    if (!cot || items.length === 0) {
      throw new Error(
        "Para ganar la oportunidad necesita una cotización con ítems. " +
          (cot ? `La ${cot.numero} está vacía.` : "Aún no tiene cotización."),
      );
    }

    const cliente = CLIENTES.find((c) => c.id === o.cliente_id)!;
    const op = await getOpsRepository().crearOp({
      cliente_id: o.cliente_id,
      ciudad_id: cliente.ciudad_id,
      segmento: cot.segmento,
      origen_clave: "cotizacion",
      cotizacion_id: cot.id,
      vendedor_id: cot.vendedor_id, // vendedor REAL heredado de la cotización
      notas: `OP generada automáticamente al ganar la oportunidad (cotización ${cot.numero}).`,
      items: items
        .filter((i) => i.producto_id !== null)
        .map((i) => ({
          producto_id: i.producto_id!,
          cantidad: i.cantidad,
          // la OP hereda el precio CON el descuento de línea ya aplicado
          precio_unit: Math.round(i.precio_unit * (1 - i.descuento_pct / 100)),
          color: i.color,
          alto_override_cm: i.alto_override_cm,
          fondo_override_cm: i.fondo_override_cm,
        })),
    });

    o.etapa_id = etapa_id;
    o.movida_en = new Date().toISOString();
    cot.estado_id = ESTADOS.find((e) => e.nombre === "Aprobada")!.id;
    return { opCreada: { id: op.id, numero: op.numero } };
  }

  async listarEtapas(): Promise<EtapaCrm[]> {
    return [...ETAPAS_CRM].sort((a, b) => a.orden - b.orden);
  }

  async listarVendedores(): Promise<Usuario[]> {
    return [...VENDEDORES];
  }
}

export class MockCotizacionesRepository implements CotizacionesRepository {
  private get store() {
    return getStore();
  }

  private card(cot: Cotizacion): CotizacionCard {
    const estado = ESTADOS.find((e) => e.id === cot.estado_id)!;
    return {
      cotizacion: structuredClone(cot),
      cliente: CLIENTES.find((c) => c.id === cot.cliente_id)!,
      vendedor: VENDEDORES.find((v) => v.id === cot.vendedor_id)!,
      estado,
      total: totalDeCotizacion(this.store, cot),
      vencida: estaVencida(cot, estado.nombre),
    };
  }

  async listar(filtros: FiltrosCotizaciones = {}): Promise<CotizacionCard[]> {
    const q = filtros.texto?.trim().toLowerCase();
    return this.store.cotizaciones
      .filter((c) => c.activo)
      .map((c) => this.card(c))
      .filter((c) => {
        if (filtros.estado_id !== undefined && c.estado.id !== filtros.estado_id)
          return false;
        if (filtros.vendedor_id && c.vendedor.id !== filtros.vendedor_id) return false;
        if (filtros.segmento && c.cotizacion.segmento !== filtros.segmento)
          return false;
        if (q) {
          const blob = [c.cotizacion.numero, c.cliente.nombre, c.vendedor.nombre]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.cotizacion.creado_en.localeCompare(a.cotizacion.creado_en));
  }

  async obtener(id: string): Promise<CotizacionDetalle | null> {
    const cot = this.store.cotizaciones.find((c) => c.id === id && c.activo);
    if (!cot) return null;
    const cliente = CLIENTES.find((c) => c.id === cot.cliente_id)!;
    const estado = ESTADOS.find((e) => e.id === cot.estado_id)!;
    const items = itemsDeCotizacion(this.store, cot.id);
    return structuredClone({
      cotizacion: cot,
      cliente,
      ciudad: CIUDADES.find((c) => c.id === cliente.ciudad_id) ?? null,
      vendedor: VENDEDORES.find((v) => v.id === cot.vendedor_id)!,
      estado,
      items,
      totales: calcularTotales(items, cot),
      vencida: estaVencida(cot, estado.nombre),
      oportunidad_id:
        this.store.oportunidades.find((o) => o.cotizacion_id === cot.id)?.id ?? null,
    });
  }

  async crear(
    input: CotizacionInput,
    oportunidadId?: string,
  ): Promise<{ id: string; numero: string }> {
    this.validarInput(input);
    const maxNum = Math.max(
      105,
      ...this.store.cotizaciones.map(
        (c) => Number(c.numero.replace("BFP-", "")) || 0,
      ),
    );
    const id = `q-${crypto.randomUUID().slice(0, 8)}`;
    const numero = `BFP-${String(maxNum + 1).padStart(4, "0")}`;
    const hoy = new Date();
    const valida = new Date(hoy);
    valida.setDate(valida.getDate() + 15); // regla: creación + 15 días
    this.store.cotizaciones.push({
      id,
      numero,
      cliente_id: input.cliente_id,
      vendedor_id: input.vendedor_id,
      segmento: input.segmento,
      estado_id: ESTADOS.find((e) => e.nombre === "Borrador")!.id,
      no_facturar: input.no_facturar,
      descuento_pct: input.descuento_pct,
      pago_anticipado_completo: input.pago_anticipado_completo,
      valida_hasta: valida.toISOString().slice(0, 10),
      tiempo_entrega: input.tiempo_entrega,
      origen: "manual",
      notas: input.notas,
      activo: true,
      eliminado_en: null,
      creado_en: hoy.toISOString(),
    });
    this.reemplazarItems(id, input.items);
    // Regla de Juan: TODA cotización queda en el embudo — nace su
    // oportunidad en "Elaborando Cotización y/o Render" (o se engancha
    // a la oportunidad existente si se cotizó desde el CRM).
    if (!this.store.oportunidades.some((o) => o.cotizacion_id === id && o.activo)) {
      const etapa =
        ETAPAS_CRM.find((e) => e.nombre === "Elaborando Cotización y/o Render") ??
        ETAPAS_CRM.find((e) => !e.es_ganada && !e.es_perdida)!;
      const existente = oportunidadId
        ? this.store.oportunidades.find(
            (o) => o.id === oportunidadId && o.activo && !o.cotizacion_id,
          )
        : undefined;
      if (existente) {
        existente.cotizacion_id = id;
        const actual = ETAPAS_CRM.find((e) => e.id === existente.etapa_id)!;
        if (!actual.es_ganada && !actual.es_perdida) existente.etapa_id = etapa.id;
        return { id, numero };
      }
      this.store.oportunidades.push({
        id: `opo-${crypto.randomUUID().slice(0, 8)}`,
        cliente_id: input.cliente_id,
        cotizacion_id: id,
        etapa_id: etapa.id,
        vendedor_id: input.vendedor_id,
        valor_estimado: null,
        notas: null,
        movida_en: tsRel(0),
        activo: true,
        eliminado_en: null,
        creado_en: tsRel(0),
      });
    }
    return { id, numero };
  }

  async actualizar(id: string, input: CotizacionInput): Promise<void> {
    this.validarInput(input);
    const cot = this.store.cotizaciones.find((c) => c.id === id && c.activo);
    if (!cot) throw new Error(`Cotización ${id} no existe`);
    const estado = ESTADOS.find((e) => e.id === cot.estado_id)!;
    // Regla de Juan (21-jul): Borradores Y Enviadas se editan.
    if (estado.nombre !== "Borrador" && estado.nombre !== "Enviada") {
      throw new Error(
        `La ${cot.numero} está ${estado.nombre} y no se puede editar. Duplíquela para re-cotizar.`,
      );
    }
    Object.assign(cot, {
      cliente_id: input.cliente_id,
      vendedor_id: input.vendedor_id,
      segmento: input.segmento,
      no_facturar: input.no_facturar,
      pago_anticipado_completo: input.pago_anticipado_completo,
      descuento_pct: input.descuento_pct,
      tiempo_entrega: input.tiempo_entrega,
      notas: input.notas,
    });
    this.reemplazarItems(id, input.items);
  }

  async marcarEnviada(id: string): Promise<void> {
    const cot = this.store.cotizaciones.find((c) => c.id === id && c.activo);
    if (!cot) throw new Error(`Cotización ${id} no existe`);
    const estado = ESTADOS.find((e) => e.id === cot.estado_id)!;
    if (estado.nombre !== "Borrador") {
      throw new Error(`La ${cot.numero} ya está ${estado.nombre}`);
    }
    if (!this.store.items.some((i) => i.cotizacion_id === id)) {
      throw new Error("No se puede enviar una cotización sin ítems");
    }
    cot.estado_id = ESTADOS.find((e) => e.nombre === "Enviada")!.id;
    // Embudo sincronizado: la oportunidad avanza a "Cotizado"
    const opo = this.store.oportunidades.find(
      (o) => o.cotizacion_id === id && o.activo,
    );
    if (opo) {
      const actual = ETAPAS_CRM.find((e) => e.id === opo.etapa_id)!;
      const cotizado = ETAPAS_CRM.find((e) => e.nombre === "Cotizado");
      if (cotizado && !actual.es_ganada && !actual.es_perdida) {
        opo.etapa_id = cotizado.id;
        opo.movida_en = tsRel(0);
      }
    }
  }

  async anular(id: string): Promise<void> {
    const cot = this.store.cotizaciones.find((c) => c.id === id && c.activo);
    if (!cot) throw new Error(`Cotización ${id} no existe`);
    const estado = ESTADOS.find((e) => e.id === cot.estado_id)!;
    if (estado.nombre === "Aprobada") {
      throw new Error(
        `La ${cot.numero} está Aprobada y ya generó OP — no se puede anular. Gestione la OP en Producción.`,
      );
    }
    if (estado.nombre === "Anulada") {
      throw new Error(`La ${cot.numero} ya está anulada`);
    }
    cot.estado_id = ESTADOS.find((e) => e.nombre === "Anulada")!.id;
    // El embudo no debe quedar con tarjetas muertas: oportunidad → Perdido
    const opo = this.store.oportunidades.find(
      (o) => o.cotizacion_id === id && o.activo,
    );
    if (opo) {
      const etapa = ETAPAS_CRM.find((e) => e.id === opo.etapa_id)!;
      if (!etapa.es_ganada && !etapa.es_perdida) {
        opo.etapa_id = ETAPAS_CRM.find((e) => e.es_perdida)!.id;
      }
    }
  }

  async duplicar(id: string): Promise<{ id: string; numero: string }> {
    const det = await this.obtener(id);
    if (!det) throw new Error("La cotización no existe");
    return this.crear({
      cliente_id: det.cotizacion.cliente_id,
      vendedor_id: det.cotizacion.vendedor_id,
      origen: det.cotizacion.origen,
      segmento: det.cotizacion.segmento,
      no_facturar: det.cotizacion.no_facturar,
      pago_anticipado_completo: det.cotizacion.pago_anticipado_completo,
      descuento_pct: det.cotizacion.descuento_pct,
      tiempo_entrega: det.cotizacion.tiempo_entrega,
      notas: det.cotizacion.notas,
      items: det.items.map((i) => ({
        producto_id: i.producto_id,
        descripcion: i.descripcion,
        es_transporte: i.es_transporte,
        aplica_iva: i.aplica_iva,
        cantidad: i.cantidad,
        precio_unit: i.precio_unit,
        descuento_pct: i.descuento_pct,
        alto_override_cm: i.alto_override_cm,
        fondo_override_cm: i.fondo_override_cm,
        color: i.color,
        recargos: i.recargos,
      })),
    });
  }

  private validarInput(input: CotizacionInput): void {
    if (!input.cliente_id) throw new Error("Seleccione el cliente");
    if (!input.vendedor_id) throw new Error("Seleccione el vendedor");
    if (input.segmento !== "B2B" && input.segmento !== "B2C") {
      throw new Error("El segmento B2B/B2C es obligatorio");
    }
    if (input.descuento_pct < 0 || input.descuento_pct > 50) {
      throw new Error("El descuento global va de 0 a 50%");
    }
    for (const it of input.items) {
      if (!it.producto_id && !it.descripcion?.trim()) {
        throw new Error("Todo ítem libre necesita descripción");
      }
      if (it.cantidad <= 0) throw new Error("Las cantidades deben ser mayores a 0");
      if (it.precio_unit < 0) throw new Error("Los precios no pueden ser negativos");
      if (it.descuento_pct < 0 || it.descuento_pct > 100) {
        throw new Error("El descuento por línea va de 0 a 100%");
      }
    }
  }

  private reemplazarItems(cotizacion_id: string, items: CotizacionItemInput[]): void {
    this.store.items = this.store.items.filter(
      (i) => i.cotizacion_id !== cotizacion_id,
    );
    items.forEach((it, n) => {
      this.store.items.push({
        id: `${cotizacion_id}-it${n}-${crypto.randomUUID().slice(0, 4)}`,
        cotizacion_id,
        producto_id: it.producto_id,
        descripcion: it.descripcion,
        es_transporte: it.es_transporte,
        aplica_iva: it.aplica_iva,
        cantidad: it.cantidad,
        precio_unit: it.precio_unit,
        descuento_pct: it.descuento_pct,
        alto_override_cm: it.alto_override_cm,
        fondo_override_cm: it.fondo_override_cm,
        color: it.color,
        recargos: it.recargos,
      });
    });
  }

  async listarClientes(): Promise<Cliente[]> {
    return [...CLIENTES].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async listarEstados(): Promise<EstadoCotizacion[]> {
    return [...ESTADOS].sort((a, b) => a.orden - b.orden);
  }

  async listarVendedores(): Promise<Usuario[]> {
    return [...VENDEDORES];
  }
}

// ---------------------------------------------------------------
// Factories — ÚNICO punto de swap a Supabase
// ---------------------------------------------------------------

export function getCrmRepository(): CrmRepository {
  globalVentas.__crmRepositorio ??= new MockCrmRepository();
  return globalVentas.__crmRepositorio;
}

export function getCotizacionesRepository(): CotizacionesRepository {
  globalVentas.__cotRepositorio ??= new MockCotizacionesRepository();
  return globalVentas.__cotRepositorio;
}
