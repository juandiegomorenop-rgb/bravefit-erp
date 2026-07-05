/**
 * Data layer de Órdenes de Pedido — INTERCAMBIABLE.
 *
 * La UI solo conoce la interfaz `OpsRepository` y el factory
 * `getOpsRepository()`. Hoy el factory devuelve `MockOpsRepository`
 * (datos en memoria); el swap a Supabase será implementar
 * `SupabaseOpsRepository` y cambiar UNA línea del factory.
 */

import type {
  Ciudad,
  Cliente,
  EtapaProduccion,
  Garantia,
  OpDespacho,
  OpHistorialEtapa,
  OpItem,
  OpObservacion,
  OrdenPedido,
  OrigenOp,
  Producto,
  Usuario,
} from "@/lib/types/db";
import {
  ordenarTarjetas,
  productoPrincipal,
  semaforo,
  type SemaforoOp,
} from "@/lib/ops-logic";

// ---------------------------------------------------------------
// Tipos enriquecidos (joins) que consume la UI
// ---------------------------------------------------------------

export interface OpItemConProducto extends OpItem {
  producto: Producto;
}

/**
 * Tarjeta unificada para las vistas Kanban / Lista / Calendario.
 * Las garantías comparten el flujo de producción y se representan
 * como tarjetas propias (tipo 'garantia') con prioridad ambulancia.
 */
export interface OpCard {
  id: string; // id de la OP o de la garantía (destino de moverEtapa)
  tipo: "op" | "garantia";
  numero: string; // OP-XXXX | GR-XXXX
  op_id: string; // OP original (destino del detalle)
  etapa_id: number;
  cliente: Cliente;
  ciudad: Ciudad | null;
  origen: OrigenOp;
  segmento: "B2B" | "B2C" | null;
  requiere_instalacion: boolean;
  esperando_proveedor: boolean;
  fecha_creacion: string; // creado_en (OP) | abierta_en (garantía)
  fecha_entrega_pactada: string | null;
  fecha_entregada: string | null;
  items: OpItemConProducto[];
  garantia: Garantia | null; // solo tarjetas tipo 'garantia'
}

export interface HistorialEtapaDetalle extends OpHistorialEtapa {
  etapa: EtapaProduccion;
}

export interface DespachoDetalle extends OpDespacho {
  item: OpItemConProducto;
}

export interface OpDetalle {
  op: OrdenPedido;
  cliente: Cliente;
  ciudad: Ciudad | null;
  origen: OrigenOp;
  etapa: EtapaProduccion;
  items: OpItemConProducto[];
  historial: HistorialEtapaDetalle[]; // ascendente por fecha
  despachos: DespachoDetalle[];
  observaciones: OpObservacion[]; // descendente por fecha
  garantias: Garantia[]; // garantías abiertas sobre esta OP
}

export interface FiltrosOps {
  etapa_id?: number;
  origen?: string; // clave del origen ('shopify'…)
  ciudad_id?: number;
  semaforo?: SemaforoOp;
  texto?: string; // busca en número, cliente, ciudad y productos
}

// ---------------------------------------------------------------
// Interfaz del repositorio
// ---------------------------------------------------------------

export interface OpCrearInput {
  cliente_id: string;
  ciudad_id: number | null;
  segmento: "B2B" | "B2C";
  origen_clave: string; // 'cotizacion' | 'shopify' | 'whatsapp' | 'planner'
  cotizacion_id: string | null;
  requiere_instalacion?: boolean;
  notas?: string;
  items: Array<{
    producto_id: string;
    cantidad: number;
    precio_unit: number;
    color?: string | null;
    alto_override_cm?: number | null;
    fondo_override_cm?: number | null;
  }>;
}

// ---- Garantías (comparten flujo y store con las OPs) -----------

export interface GarantiaCard {
  garantia: Garantia;
  cliente: Cliente;
  producto: Producto | null;
  vendedor: Usuario | null;
  op_numero: string;
  etapa: EtapaProduccion;
  /** Días desde apertura (hasta cierre si ya cerró). */
  dias: number;
}

export interface GarantiaDetalle extends GarantiaCard {
  op: OrdenPedido;
  ciudad: Ciudad | null;
}

export interface GarantiaFiltros {
  estado?: "abiertas" | "cerradas";
  texto?: string;
}

export interface GarantiaCrearInput {
  op_id: string;
  producto_id: string | null;
  problema: string;
  detalle: string | null;
  recogida: Garantia["recogida"];
  vendedor_id: string | null;
}

export interface OpsRepository {
  listarOps(filtros?: FiltrosOps): Promise<OpCard[]>;
  obtenerOp(id: string): Promise<OpDetalle | null>;
  moverEtapa(cardId: string, etapa_id: number, nota?: string): Promise<void>;
  registrarDespacho(
    op_item_id: string,
    cantidad: number,
    nota?: string,
  ): Promise<void>;
  agregarObservacion(op_id: string, texto: string): Promise<OpObservacion>;
  /** OP automática (CRM Ganado, webhooks): entra SIEMPRE a "En Cola". */
  crearOp(input: OpCrearInput): Promise<OrdenPedido>;
  // Garantías: mismo flujo de etapas, prioridad ambulancia
  listarGarantias(filtros?: GarantiaFiltros): Promise<GarantiaCard[]>;
  obtenerGarantia(id: string): Promise<GarantiaDetalle | null>;
  /** Nace en "En Cola" con el siguiente GR-XXXX; hereda cliente de la OP. */
  crearGarantia(input: GarantiaCrearInput): Promise<Garantia>;
  actualizarGarantia(
    id: string,
    patch: Partial<
      Pick<Garantia, "recogida" | "costo_resolucion" | "detalle" | "vendedor_id">
    >,
  ): Promise<void>;
  listarEtapas(): Promise<EtapaProduccion[]>;
  listarOrigenes(): Promise<OrigenOp[]>;
  listarCiudades(): Promise<Ciudad[]>;
}

/** Filtro puro y compartible (lo usan el mock y la UI optimista). */
export function aplicarFiltros(
  cards: OpCard[],
  filtros: FiltrosOps,
  hoy: Date = new Date(),
): OpCard[] {
  const q = filtros.texto?.trim().toLowerCase();
  return cards.filter((c) => {
    if (filtros.etapa_id !== undefined && c.etapa_id !== filtros.etapa_id)
      return false;
    if (filtros.origen && c.origen.clave !== filtros.origen) return false;
    if (
      filtros.ciudad_id !== undefined &&
      (c.ciudad?.id ?? -1) !== filtros.ciudad_id
    )
      return false;
    if (
      filtros.semaforo &&
      semaforo(c.fecha_entrega_pactada, c.fecha_entregada, hoy) !==
        filtros.semaforo
    )
      return false;
    if (q) {
      const principal = productoPrincipal(c.items);
      const blob = [
        c.numero,
        c.cliente.nombre,
        c.ciudad?.nombre ?? "",
        principal?.producto.nombre ?? "",
        ...c.items.map((i) => i.producto.nombre),
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

// ===============================================================
// MOCK — datos realistas Bravefit (equipos de gimnasio, COP)
// ===============================================================

/** Fecha "YYYY-MM-DD" relativa a hoy (mock siempre vigente). */
export function fechaRel(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Timestamp ISO relativo a hoy, a las `hora` local. */
export function tsRel(dias: number, hora = 9, minuto = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}

// Espejo EXACTO de seed.sql (12 etapas). Si cambian en Configuración,
// el kanban se adapta solo: las columnas se derivan de esta lista.
const ETAPAS: EtapaProduccion[] = [
  { id: 1, nombre: "En Cola", orden: 1, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 2, nombre: "Corte", orden: 2, es_entrega: false, es_terminal: false, descuenta_mp: true, activo: true },
  { id: 3, nombre: "Soldadura", orden: 3, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 4, nombre: "Perforación", orden: 4, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 5, nombre: "Pintura", orden: 5, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 6, nombre: "Ensamble", orden: 6, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 7, nombre: "Empaque", orden: 7, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 8, nombre: "Esperando Transportadora", orden: 8, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 9, nombre: "En Reparto", orden: 9, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 10, nombre: "Entregado", orden: 10, es_entrega: true, es_terminal: true, descuenta_mp: false, activo: true },
  { id: 11, nombre: "Pendiente instalación", orden: 11, es_entrega: false, es_terminal: false, descuenta_mp: false, activo: true },
  { id: 12, nombre: "Instalado", orden: 12, es_entrega: false, es_terminal: true, descuenta_mp: false, activo: true },
];

const ORIGENES: OrigenOp[] = [
  { id: 1, clave: "cotizacion", nombre: "Cotización", activo: true },
  { id: 2, clave: "shopify", nombre: "Shopify", activo: true },
  { id: 3, clave: "whatsapp", nombre: "WhatsApp", activo: true },
  { id: 4, clave: "planner", nombre: "Planner", activo: true },
];

export const CIUDADES: Ciudad[] = [
  { id: 1, nombre: "Medellín", departamento: "Antioquia" },
  { id: 2, nombre: "Bogotá", departamento: "Bogotá D.C." },
  { id: 3, nombre: "Cali", departamento: "Valle del Cauca" },
  { id: 4, nombre: "Envigado", departamento: "Antioquia" },
  { id: 5, nombre: "Rionegro", departamento: "Antioquia" },
  { id: 6, nombre: "Barranquilla", departamento: "Atlántico" },
];

function prod(
  id: string,
  sku: string,
  nombre: string,
  categoria_id: number,
  precio_lista: number,
  extra: Partial<Producto> = {},
): Producto {
  return {
    id,
    sku,
    sku_siigo: null,
    shopify_product_id: null,
    nombre,
    descripcion: null,
    categoria_id,
    clasificacion: "MTS",
    origen: "propio",
    es_rack: false,
    unidad_id: 1,
    precio_lista,
    costo_estandar: null,
    ancho_cm: null,
    profundidad_cm: null,
    alto_cm: null,
    peso_kg: null,
    colores_disponibles: [],
    color_default: null,
    imagen_url: null,
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(-300),
    ...extra,
  };
}

export const PRODUCTOS: Producto[] = [
  prod("p-01", "BF-RK-001", "Rack PF5", 1, 4_190_000, { es_rack: true, clasificacion: "MTO", colores_disponibles: ["Negro mate", "Blanco", "Rojo"], color_default: "Negro mate", alto_cm: 230, imagen_url: "/productos/rack-pf5-fijo.png" }),
  prod("p-02", "BF-RK-002", "Rack PF5 Pro", 1, 5_890_000, { es_rack: true, clasificacion: "MTO", alto_cm: 245, imagen_url: "/productos/rack-pf5-fijo.png" }),
  prod("p-03", "BF-RG-001", "Rig Cross 4 estaciones", 2, 14_500_000, { es_rack: true, clasificacion: "MTO" }),
  prod("p-04", "BF-RK-003", "Rack de pared PF3", 1, 2_790_000, { es_rack: true, clasificacion: "ATO", imagen_url: "/productos/rack-pf5-fijo.png" }),
  prod("p-05", "BF-BN-001", "Banco plano BF", 6, 850_000, { imagen_url: "/productos/banco-plano.png" }),
  prod("p-06", "BF-BN-002", "Banco ajustable BF Pro", 6, 1_490_000, { imagen_url: "/productos/banco-reclinable-001.png" }),
  prod("p-07", "BF-BR-001", "Barra olímpica 20 kg", 6, 1_150_000, { origen: "comercializado", imagen_url: "/productos/barra-olimpica-001.png" }),
  prod("p-08", "BF-DS-001", "Set discos bumper 100 kg", 6, 3_200_000, { origen: "comercializado" }),
  prod("p-09", "BF-RK-004", "Jaula de potencia PF7", 1, 7_490_000, { es_rack: true, clasificacion: "MTO", imagen_url: "/productos/rack-pf5-fijo.png" }),
  prod("p-10", "BF-AC-001", "Soportes J-Cups (par)", 3, 290_000),
  prod("p-11", "BF-MQ-001", "Prensa de piernas 45°", 6, 9_800_000, { imagen_url: "/productos/sistema-polea-bloques-rack.png" }),
  prod("p-12", "BF-MC-001", "Kit mancuernas 2,5–25 kg", 6, 4_600_000, { origen: "comercializado" }),
];

/**
 * Los 5 usuarios con login (fuente única). rol_id: 1=Administrador,
 * 2=Operaciones 1, 3=Operaciones 2. crm-cotizaciones re-exporta los que
 * venden (admins) como VENDEDORES.
 */
export const USUARIOS: Usuario[] = [
  { id: "u-01", rol_id: 1, nombre: "Juan Diego Moreno", email: "juanmoreno@bravefit.co", activo: true },
  { id: "u-02", rol_id: 1, nombre: "María Fernández", email: "maria@bravefit.co", activo: true },
  { id: "u-03", rol_id: 1, nombre: "Camilo Torres", email: "camilo@bravefit.co", activo: true },
  { id: "u-04", rol_id: 2, nombre: "Jorge Betancur", email: "jorge@bravefit.co", activo: true },
  { id: "u-05", rol_id: 3, nombre: "Wilson Pérez", email: "wilson@bravefit.co", activo: true },
];

/** Colores estándar (tabla colores del seed) — fuera de esta lista = ATO 8%. */
export const COLORES_ESTANDAR = [
  "Negro",
  "Rojo",
  "Azul",
  "Blanco",
  "Gris",
  "Verde militar",
] as const;

/** Dimensiones variables por producto (espejo de producto_dimensiones). */
export const PRODUCTO_DIMENSIONES: import("@/lib/types/db").ProductoDimension[] = [
  { id: "pd-01a", producto_id: "p-01", eje: "alto", min_cm: 150, max_cm: 300, default_cm: 230, precio_por_cm_extra: 4000 },
  { id: "pd-01f", producto_id: "p-01", eje: "fondo", min_cm: 50, max_cm: 150, default_cm: 50, precio_por_cm_extra: 4000 },
  { id: "pd-02a", producto_id: "p-02", eje: "alto", min_cm: 180, max_cm: 300, default_cm: 245, precio_por_cm_extra: 4500 },
  { id: "pd-04a", producto_id: "p-04", eje: "alto", min_cm: 150, max_cm: 280, default_cm: 220, precio_por_cm_extra: 3500 },
  { id: "pd-09a", producto_id: "p-09", eje: "alto", min_cm: 200, max_cm: 280, default_cm: 235, precio_por_cm_extra: 5000 },
  { id: "pd-09f", producto_id: "p-09", eje: "fondo", min_cm: 120, max_cm: 180, default_cm: 140, precio_por_cm_extra: 5000 },
];

/** Categorías 1:1 con seed.sql (y Shopify). */
export const CATEGORIAS: { id: number; nombre: string; orden: number }[] = [
  { id: 1, nombre: "Racks", orden: 1 },
  { id: 2, nombre: "Rigs", orden: 2 },
  { id: 3, nombre: "Accesorios", orden: 3 },
  { id: 4, nombre: "Outdoor", orden: 4 },
  { id: 5, nombre: "Hogar", orden: 5 },
  { id: 6, nombre: "Fuerza", orden: 6 },
  { id: 7, nombre: "Acondicionamiento", orden: 7 },
  { id: 8, nombre: "Almacenamiento", orden: 8 },
];

function cli(
  id: string,
  nombre: string,
  tipo: "persona" | "empresa",
  ciudad_id: number,
  telefono: string,
  direccion: string,
): Cliente {
  return {
    id,
    tipo,
    nombre,
    nit_cedula: tipo === "empresa" ? "900.123.456-7" : "1.020.345.678",
    email: `${id}@correo.com`,
    telefono,
    ciudad_id,
    direccion,
    canal_preferido: null,
    siigo_id: null,
    notas: null,
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(-200),
  };
}

export const CLIENTES: Cliente[] = [
  cli("c-01", "SmartFit Poblado", "empresa", 1, "604 444 1010", "Cl. 10 #43E-25, El Poblado"),
  cli("c-02", "CrossFit Jungle", "empresa", 4, "604 331 2244", "Cra. 43A #38 Sur-102"),
  cli("c-03", "Laura Gómez", "persona", 1, "301 555 7788", "Cra. 78 #45-12, Laureles"),
  cli("c-04", "Hotel Dann Carlton", "empresa", 1, "604 444 5151", "Cra. 43A #7-50, El Poblado"),
  cli("c-05", "Gym House 93", "empresa", 2, "601 743 9090", "Cl. 93B #13-40"),
  cli("c-06", "Andrés Ramírez", "persona", 3, "315 222 3344", "Cl. 5 #38-25, San Fernando"),
  cli("c-07", "Colegio San Ignacio", "empresa", 1, "604 250 6161", "Cl. 48 #68-98"),
  cli("c-08", "Bodyfit 80", "empresa", 2, "601 610 8080", "Av. Cl. 80 #69Q-50"),
  cli("c-09", "CrossFit La Ceja", "empresa", 5, "320 777 1122", "Vía La Ceja km 2"),
  cli("c-10", "Marcela Restrepo", "persona", 1, "300 888 9911", "Circular 4 #70-22"),
  cli("c-11", "Coliseo Mayor", "empresa", 3, "602 555 4433", "Cl. 9 #34-01"),
  cli("c-12", "Funcional 360", "empresa", 6, "605 385 2020", "Cra. 51B #87-15"),
  cli("c-13", "Torre Empresarial GNB", "empresa", 2, "601 326 7700", "Cl. 72 #10-07"),
  cli("c-14", "Pedro Aguirre", "persona", 4, "312 444 5566", "Loma del Esmeraldal #27-80"),
  cli("c-15", "Studio Pilates Vida", "empresa", 1, "604 580 3030", "Cl. 30 #65B-14, Belén"),
];

interface OpSeed {
  id: string;
  numero: string;
  cliente_id: string;
  ciudad_id: number;
  segmento: "B2B" | "B2C";
  origen_id: number;
  etapa_id: number;
  instalacion?: boolean;
  esperando_proveedor?: boolean;
  creada: number; // días relativos a hoy
  pactada: number | null;
  entregada?: number;
  notas?: string;
}

function opSeed(s: OpSeed): OrdenPedido {
  const cliente = CLIENTES.find((c) => c.id === s.cliente_id);
  return {
    id: s.id,
    numero: s.numero,
    cliente_id: s.cliente_id,
    ciudad_id: s.ciudad_id,
    segmento: s.segmento,
    origen_id: s.origen_id,
    cotizacion_id: s.origen_id === 1 ? `cot-${s.id}` : null,
    pedido_web_id: s.origen_id === 2 ? `pw-${s.id}` : null,
    etapa_id: s.etapa_id,
    esperando_proveedor: s.esperando_proveedor ?? false,
    requiere_instalacion: s.instalacion ?? false,
    direccion_entrega: cliente?.direccion ?? null,
    fecha_entrega_pactada: s.pactada === null ? null : fechaRel(s.pactada),
    fecha_entregada: s.entregada === undefined ? null : fechaRel(s.entregada),
    mp_descontada_en: s.etapa_id >= 2 ? tsRel(s.creada + 2, 14) : null,
    notas: s.notas ?? null,
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(s.creada, 10),
  };
}

const OPS: OrdenPedido[] = [
  opSeed({ id: "op-01", numero: "OP-1041", cliente_id: "c-01", ciudad_id: 1, segmento: "B2B", origen_id: 1, etapa_id: 3, instalacion: true, creada: -18, pactada: 28 }),
  opSeed({ id: "op-02", numero: "OP-1042", cliente_id: "c-02", ciudad_id: 4, segmento: "B2B", origen_id: 3, etapa_id: 2, instalacion: true, creada: -10, pactada: 18 }),
  opSeed({ id: "op-03", numero: "OP-1043", cliente_id: "c-03", ciudad_id: 1, segmento: "B2C", origen_id: 2, etapa_id: 1, esperando_proveedor: true, creada: -3, pactada: 10, notas: "Barra comercializada: llega del proveedor el martes." }),
  opSeed({ id: "op-04", numero: "OP-1044", cliente_id: "c-04", ciudad_id: 1, segmento: "B2B", origen_id: 1, etapa_id: 5, instalacion: true, creada: -35, pactada: -3, notas: "Reproceso de pintura en dorado — coordinar nueva fecha con el hotel." }),
  opSeed({ id: "op-05", numero: "OP-1045", cliente_id: "c-05", ciudad_id: 2, segmento: "B2B", origen_id: 4, etapa_id: 6, creada: -22, pactada: 6 }),
  opSeed({ id: "op-06", numero: "OP-1046", cliente_id: "c-06", ciudad_id: 3, segmento: "B2C", origen_id: 2, etapa_id: 10, creada: -30, pactada: -10, entregada: -12 }),
  opSeed({ id: "op-07", numero: "OP-1047", cliente_id: "c-07", ciudad_id: 1, segmento: "B2B", origen_id: 1, etapa_id: 4, instalacion: true, creada: -14, pactada: 16 }),
  opSeed({ id: "op-08", numero: "OP-1048", cliente_id: "c-08", ciudad_id: 2, segmento: "B2B", origen_id: 1, etapa_id: 2, instalacion: true, creada: -7, pactada: 24 }),
  opSeed({ id: "op-09", numero: "OP-1049", cliente_id: "c-09", ciudad_id: 5, segmento: "B2B", origen_id: 3, etapa_id: 9, creada: -20, pactada: 12 }),
  opSeed({ id: "op-10", numero: "OP-1050", cliente_id: "c-10", ciudad_id: 1, segmento: "B2C", origen_id: 4, etapa_id: 1, creada: -1, pactada: 35 }),
  opSeed({ id: "op-11", numero: "OP-1051", cliente_id: "c-11", ciudad_id: 3, segmento: "B2B", origen_id: 1, etapa_id: 8, instalacion: true, creada: -40, pactada: -6, notas: "Pendiente confirmar saldo antes de despachar los racks." }),
  opSeed({ id: "op-12", numero: "OP-1052", cliente_id: "c-12", ciudad_id: 6, segmento: "B2B", origen_id: 2, etapa_id: 10, creada: -25, pactada: -1, entregada: -2 }),
  opSeed({ id: "op-13", numero: "OP-1053", cliente_id: "c-13", ciudad_id: 2, segmento: "B2B", origen_id: 1, etapa_id: 7, instalacion: true, creada: -9, pactada: 20 }),
  opSeed({ id: "op-14", numero: "OP-1054", cliente_id: "c-14", ciudad_id: 4, segmento: "B2C", origen_id: 3, etapa_id: 1, creada: -2, pactada: 15 }),
  opSeed({ id: "op-15", numero: "OP-1055", cliente_id: "c-15", ciudad_id: 1, segmento: "B2B", origen_id: 4, etapa_id: 11, instalacion: true, creada: -50, pactada: -20, entregada: -18 }),
];

function itemSeed(
  id: string,
  op_id: string,
  producto_id: string,
  cantidad: number,
  entregada = 0,
  extra: Partial<OpItem> = {},
): OpItem {
  const producto = PRODUCTOS.find((p) => p.id === producto_id);
  return {
    id,
    op_id,
    producto_id,
    cantidad,
    cantidad_entregada: entregada,
    precio_unit: producto?.precio_lista ?? 0,
    alto_override_cm: null,
    fondo_override_cm: null,
    color: null,
    ...extra,
  };
}

const ITEMS: OpItem[] = [
  itemSeed("it-01a", "op-01", "p-02", 4),
  itemSeed("it-01b", "op-01", "p-05", 8),
  itemSeed("it-01c", "op-01", "p-07", 4),
  itemSeed("it-02a", "op-02", "p-03", 1),
  itemSeed("it-02b", "op-02", "p-08", 2),
  itemSeed("it-03a", "op-03", "p-04", 1),
  itemSeed("it-03b", "op-03", "p-07", 1),
  itemSeed("it-04a", "op-04", "p-01", 2, 0, { color: "Dorado" }),
  itemSeed("it-04b", "op-04", "p-06", 2),
  itemSeed("it-04c", "op-04", "p-11", 1),
  itemSeed("it-05a", "op-05", "p-01", 1, 0, { alto_override_cm: 220, color: "Blanco" }),
  itemSeed("it-05b", "op-05", "p-10", 1, 1),
  itemSeed("it-06a", "op-06", "p-05", 1, 1),
  itemSeed("it-07a", "op-07", "p-04", 2),
  itemSeed("it-07b", "op-07", "p-05", 4),
  itemSeed("it-08a", "op-08", "p-09", 1),
  itemSeed("it-08b", "op-08", "p-08", 1),
  itemSeed("it-08c", "op-08", "p-12", 1),
  itemSeed("it-09a", "op-09", "p-03", 1),
  itemSeed("it-09b", "op-09", "p-10", 6, 4),
  itemSeed("it-10a", "op-10", "p-01", 1, 0, { color: "Rojo" }),
  itemSeed("it-11a", "op-11", "p-02", 3),
  itemSeed("it-11b", "op-11", "p-08", 12, 8),
  itemSeed("it-12a", "op-12", "p-06", 2, 2),
  itemSeed("it-12b", "op-12", "p-12", 1, 1),
  itemSeed("it-13a", "op-13", "p-09", 1),
  itemSeed("it-13b", "op-13", "p-06", 2),
  itemSeed("it-14a", "op-14", "p-05", 1),
  itemSeed("it-14b", "op-14", "p-07", 1),
  itemSeed("it-15a", "op-15", "p-04", 1, 1),
  itemSeed("it-15b", "op-15", "p-06", 2, 2),
];

function garSeed(g: {
  id: string;
  numero: string;
  op_id: string;
  producto_id: string;
  cliente_id: string;
  vendedor_id: string;
  problema: string;
  detalle?: string;
  recogida: Garantia["recogida"];
  etapa_id: number;
  costo?: number;
  abierta: number; // días relativos
  cerrada?: number;
}): Garantia {
  return {
    id: g.id,
    numero: g.numero,
    op_id: g.op_id,
    producto_id: g.producto_id,
    cliente_id: g.cliente_id,
    vendedor_id: g.vendedor_id,
    problema: g.problema,
    detalle: g.detalle ?? null,
    recogida: g.recogida,
    etapa_id: g.etapa_id,
    costo_resolucion: g.costo ?? null,
    abierta_en: tsRel(g.abierta, 11),
    cerrada_en: g.cerrada === undefined ? null : tsRel(g.cerrada, 16),
    activo: true,
    eliminado_en: null,
  };
}

const GARANTIAS: Garantia[] = [
  // ---- abiertas (aparecen en el kanban con prioridad ambulancia) ----
  garSeed({ id: "gr-01", numero: "GR-0007", op_id: "op-06", producto_id: "p-05", cliente_id: "c-06", vendedor_id: "u-01", problema: "Tapizado del banco descosido", detalle: "El cliente reporta costura abierta en la esquina del tapizado a las 3 semanas de uso. Se recoge en Cali y se retapiza en planta.", recogida: "bravefit_recoge", etapa_id: 3, costo: 120_000, abierta: -5 }),
  garSeed({ id: "gr-02", numero: "GR-0008", op_id: "op-12", producto_id: "p-06", cliente_id: "c-12", vendedor_id: "u-02", problema: "Pin de ajuste del respaldo no bloquea", detalle: "El pin del respaldo no asegura en la posición 3. El cliente envía el banco por transportadora; revisar mecanizado del pasador.", recogida: "cliente_envia", etapa_id: 1, abierta: -2 }),
  garSeed({ id: "gr-03", numero: "GR-0009", op_id: "op-15", producto_id: "p-04", cliente_id: "c-15", vendedor_id: "u-03", problema: "Pintura descascarada en soporte de pared", detalle: "Descascaramiento en la zona de anclaje. Se repinta el soporte; posible fricción con la platina.", recogida: "por_definir", etapa_id: 1, abierta: -1 }),
  // ---- cerradas (histórico para KPIs de mes/año) ----
  garSeed({ id: "gr-04", numero: "GR-0006", op_id: "op-06", producto_id: "p-05", cliente_id: "c-06", vendedor_id: "u-01", problema: "Tornillería incompleta en la entrega", recogida: "cliente_envia", etapa_id: 10, costo: 18_000, abierta: -24, cerrada: -20 }),
  garSeed({ id: "gr-05", numero: "GR-0005", op_id: "op-12", producto_id: "p-12", cliente_id: "c-12", vendedor_id: "u-02", problema: "Mancuerna 15 kg con recubrimiento fisurado", recogida: "bravefit_recoge", etapa_id: 10, costo: 95_000, abierta: -55, cerrada: -47 }),
  garSeed({ id: "gr-06", numero: "GR-0004", op_id: "op-15", producto_id: "p-06", cliente_id: "c-15", vendedor_id: "u-01", problema: "Ruido en el mecanismo de ajuste", recogida: "bravefit_recoge", etapa_id: 10, costo: 60_000, abierta: -95, cerrada: -88 }),
  garSeed({ id: "gr-07", numero: "GR-0003", op_id: "op-06", producto_id: "p-05", cliente_id: "c-06", vendedor_id: "u-03", problema: "Nivelador de pata defectuoso", recogida: "cliente_envia", etapa_id: 10, costo: 25_000, abierta: -150, cerrada: -146 }),
  garSeed({ id: "gr-08", numero: "GR-0002", op_id: "op-12", producto_id: "p-06", cliente_id: "c-12", vendedor_id: "u-02", problema: "Tapizado con arruga de fábrica", recogida: "bravefit_recoge", etapa_id: 10, costo: 110_000, abierta: -210, cerrada: -200 }),
];

const OBSERVACIONES: OpObservacion[] = [
  { id: 1, op_id: "op-04", usuario_id: null, texto: "Pintura re-procesada por defecto en el tono dorado. Se repite la capa final.", via: "app", en: tsRel(-6, 15) },
  { id: 2, op_id: "op-04", usuario_id: null, texto: "El hotel pide reprogramar la instalación para un fin de semana.", via: "app", en: tsRel(-4, 10) },
  { id: 3, op_id: "op-11", usuario_id: null, texto: "Pendiente confirmación de saldo (40%) antes de despachar los 3 racks.", via: "app", en: tsRel(-3, 9) },
  { id: 4, op_id: "op-05", usuario_id: null, texto: "El rack va en blanco con el logo del gimnasio en vinilo.", via: "chat", en: tsRel(-15, 12) },
  { id: 5, op_id: "op-03", usuario_id: null, texto: "Esperando la barra del proveedor — confirman llegada el martes.", via: "app", en: tsRel(-1, 17) },
];

// ---------------------------------------------------------------
// Implementación mock (estado en memoria por instancia)
// ---------------------------------------------------------------

export class MockOpsRepository implements OpsRepository {
  private ops: OrdenPedido[] = structuredClone(OPS);
  private items: OpItem[] = structuredClone(ITEMS);
  private garantias: Garantia[] = structuredClone(GARANTIAS);
  private observaciones: OpObservacion[] = structuredClone(OBSERVACIONES);
  private historial: OpHistorialEtapa[];
  private despachos: OpDespacho[];

  constructor() {
    this.historial = this.generarHistorial();
    this.despachos = this.generarDespachos();
  }

  /** Historial coherente: una entrada por etapa recorrida, cada 2–3 días. */
  private generarHistorial(): OpHistorialEtapa[] {
    const out: OpHistorialEtapa[] = [];
    let id = 1;
    for (const op of this.ops) {
      const ordenActual = this.etapa(op.etapa_id).orden;
      const recorridas = ETAPAS.filter((e) => e.orden <= ordenActual);
      const creada = new Date(op.creado_en);
      recorridas.forEach((e, i) => {
        const en = new Date(creada);
        en.setDate(en.getDate() + i * 3);
        if (en > new Date()) en.setTime(Date.now() - 3_600_000);
        out.push({
          id: id++,
          op_id: op.id,
          etapa_id: e.id,
          usuario_id: null,
          nota: e.orden === 1 ? "OP creada" : null,
          en: en.toISOString(),
        });
      });
    }
    return out;
  }

  /** Un despacho por ítem con cantidad_entregada > 0 (consistencia trigger). */
  private generarDespachos(): OpDespacho[] {
    const out: OpDespacho[] = [];
    let id = 1;
    for (const it of this.items) {
      if (it.cantidad_entregada <= 0) continue;
      const op = this.ops.find((o) => o.id === it.op_id);
      const parcial = it.cantidad_entregada < it.cantidad;
      out.push({
        id: id++,
        op_item_id: it.id,
        cantidad: it.cantidad_entregada,
        usuario_id: null,
        nota: parcial ? "Entrega parcial — resto en producción" : null,
        en: op?.fecha_entregada
          ? `${op.fecha_entregada}T15:00:00.000Z`
          : tsRel(-2, 15),
      });
    }
    return out;
  }

  private etapa(id: number): EtapaProduccion {
    const e = ETAPAS.find((x) => x.id === id);
    if (!e) throw new Error(`Etapa ${id} no existe`);
    return e;
  }

  private itemsDeOp(op_id: string): OpItemConProducto[] {
    return this.items
      .filter((i) => i.op_id === op_id)
      .map((i) => ({
        ...i,
        producto: PRODUCTOS.find((p) => p.id === i.producto_id)!,
      }));
  }

  private cardDeOp(op: OrdenPedido): OpCard {
    return {
      id: op.id,
      tipo: "op",
      numero: op.numero,
      op_id: op.id,
      etapa_id: op.etapa_id,
      cliente: CLIENTES.find((c) => c.id === op.cliente_id)!,
      ciudad: CIUDADES.find((c) => c.id === op.ciudad_id) ?? null,
      origen: ORIGENES.find((o) => o.id === op.origen_id)!,
      segmento: op.segmento,
      requiere_instalacion: op.requiere_instalacion,
      esperando_proveedor: op.esperando_proveedor,
      fecha_creacion: op.creado_en,
      fecha_entrega_pactada: op.fecha_entrega_pactada,
      fecha_entregada: op.fecha_entregada,
      items: this.itemsDeOp(op.id),
      garantia: null,
    };
  }

  private cardDeGarantia(g: Garantia): OpCard {
    const op = this.ops.find((o) => o.id === g.op_id)!;
    const producto = PRODUCTOS.find((p) => p.id === g.producto_id);
    return {
      id: g.id,
      tipo: "garantia",
      numero: g.numero,
      op_id: g.op_id,
      etapa_id: g.etapa_id,
      cliente: CLIENTES.find((c) => c.id === g.cliente_id)!,
      ciudad: CIUDADES.find((c) => c.id === op.ciudad_id) ?? null,
      origen: ORIGENES.find((o) => o.id === op.origen_id)!,
      segmento: op.segmento,
      requiere_instalacion: false,
      esperando_proveedor: false,
      fecha_creacion: g.abierta_en,
      fecha_entrega_pactada: null,
      fecha_entregada: g.cerrada_en,
      items: producto
        ? [
            {
              id: `gi-${g.id}`,
              op_id: g.op_id,
              producto_id: producto.id,
              cantidad: 1,
              cantidad_entregada: 0,
              precio_unit: 0,
              alto_override_cm: null,
              fondo_override_cm: null,
              color: null,
              producto,
            },
          ]
        : [],
      garantia: g,
    };
  }

  async listarOps(filtros: FiltrosOps = {}): Promise<OpCard[]> {
    const cards = [
      ...this.ops.filter((o) => o.activo).map((o) => this.cardDeOp(o)),
      ...this.garantias
        .filter((g) => g.activo && !g.cerrada_en)
        .map((g) => this.cardDeGarantia(g)),
    ];
    return ordenarTarjetas(aplicarFiltros(cards, filtros));
  }

  async obtenerOp(id: string): Promise<OpDetalle | null> {
    // acepta el id de una garantía y resuelve a su OP original
    const garantia = this.garantias.find((g) => g.id === id);
    const opId = garantia?.op_id ?? id;
    const op = this.ops.find((o) => o.id === opId && o.activo);
    if (!op) return null;

    const items = this.itemsDeOp(op.id);
    return structuredClone({
      op,
      cliente: CLIENTES.find((c) => c.id === op.cliente_id)!,
      ciudad: CIUDADES.find((c) => c.id === op.ciudad_id) ?? null,
      origen: ORIGENES.find((o) => o.id === op.origen_id)!,
      etapa: this.etapa(op.etapa_id),
      items,
      historial: this.historial
        .filter((h) => h.op_id === op.id)
        .sort((a, b) => a.en.localeCompare(b.en))
        .map((h) => ({ ...h, etapa: this.etapa(h.etapa_id) })),
      despachos: this.despachos
        .filter((d) => items.some((i) => i.id === d.op_item_id))
        .sort((a, b) => b.en.localeCompare(a.en))
        .map((d) => ({ ...d, item: items.find((i) => i.id === d.op_item_id)! })),
      observaciones: this.observaciones
        .filter((o) => o.op_id === op.id)
        .sort((a, b) => b.en.localeCompare(a.en)),
      garantias: this.garantias.filter((g) => g.op_id === op.id && g.activo),
    });
  }

  async moverEtapa(cardId: string, etapa_id: number, nota?: string): Promise<void> {
    const etapa = this.etapa(etapa_id);

    const garantia = this.garantias.find((g) => g.id === cardId);
    if (garantia) {
      garantia.etapa_id = etapa_id;
      if (etapa.es_entrega || etapa.es_terminal) {
        garantia.cerrada_en = new Date().toISOString();
      }
      return;
    }

    const op = this.ops.find((o) => o.id === cardId);
    if (!op) throw new Error(`OP ${cardId} no existe`);
    op.etapa_id = etapa_id;
    if (etapa.descuenta_mp && !op.mp_descontada_en) {
      op.mp_descontada_en = new Date().toISOString();
    }
    // Réplica del trigger fn_validar_entrega_op: la fecha de entrega solo
    // se estampa cuando el 100% está despachado.
    const items = this.items.filter((i) => i.op_id === op.id);
    const completo =
      items.length > 0 && items.every((i) => i.cantidad_entregada >= i.cantidad);
    if (etapa.es_entrega && !op.fecha_entregada && completo) {
      op.fecha_entregada = fechaRel(0);
    }
    this.historial.push({
      id: Math.max(0, ...this.historial.map((h) => h.id)) + 1,
      op_id: op.id,
      etapa_id,
      usuario_id: null,
      nota: nota ?? null,
      en: new Date().toISOString(),
    });
  }

  async registrarDespacho(op_item_id: string, cantidad: number, nota?: string): Promise<void> {
    const item = this.items.find((i) => i.id === op_item_id);
    if (!item) throw new Error(`Ítem ${op_item_id} no existe`);
    const pendiente = item.cantidad - item.cantidad_entregada;
    if (cantidad <= 0 || cantidad > pendiente) {
      throw new Error(`Cantidad inválida: pendiente ${pendiente}`);
    }
    item.cantidad_entregada += cantidad;
    this.despachos.push({
      id: Math.max(0, ...this.despachos.map((d) => d.id)) + 1,
      op_item_id,
      cantidad,
      usuario_id: null,
      nota: nota ?? null,
      en: new Date().toISOString(),
    });
  }

  async crearOp(input: OpCrearInput): Promise<OrdenPedido> {
    const origen = ORIGENES.find((o) => o.clave === input.origen_clave);
    if (!origen) throw new Error(`Origen '${input.origen_clave}' no existe`);
    if (input.items.length === 0) {
      throw new Error("Una OP no puede crearse sin ítems");
    }
    const maxNum = Math.max(
      1000,
      ...this.ops.map((o) => Number(o.numero.replace("OP-", "")) || 0),
    );
    const id = `op-${crypto.randomUUID().slice(0, 8)}`;
    // comercializados puros: entran a Cola esperando proveedor
    const soloComercializados = input.items.every(
      (i) => PRODUCTOS.find((p) => p.id === i.producto_id)?.origen === "comercializado",
    );
    const op: OrdenPedido = {
      id,
      numero: `OP-${maxNum + 1}`,
      cliente_id: input.cliente_id,
      ciudad_id: input.ciudad_id,
      segmento: input.segmento,
      origen_id: origen.id,
      cotizacion_id: input.cotizacion_id,
      pedido_web_id: null,
      etapa_id: ETAPAS[0].id, // SIEMPRE En Cola
      esperando_proveedor: soloComercializados,
      requiere_instalacion: input.requiere_instalacion ?? false,
      direccion_entrega:
        CLIENTES.find((c) => c.id === input.cliente_id)?.direccion ?? null,
      fecha_entrega_pactada: null,
      fecha_entregada: null,
      mp_descontada_en: null,
      notas: input.notas ?? null,
      activo: true,
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    };
    this.ops.push(op);
    input.items.forEach((it, i) => {
      this.items.push({
        id: `${id}-it${i}`,
        op_id: id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        cantidad_entregada: 0,
        precio_unit: it.precio_unit,
        alto_override_cm: it.alto_override_cm ?? null,
        fondo_override_cm: it.fondo_override_cm ?? null,
        color: it.color ?? null,
      });
    });
    this.historial.push({
      id: Math.max(0, ...this.historial.map((h) => h.id)) + 1,
      op_id: id,
      etapa_id: ETAPAS[0].id,
      usuario_id: null,
      nota: input.notas ?? "OP creada",
      en: op.creado_en,
    });
    return structuredClone(op);
  }

  private garantiaCard(g: Garantia): GarantiaCard {
    const op = this.ops.find((o) => o.id === g.op_id)!;
    const fin = g.cerrada_en ? new Date(g.cerrada_en) : new Date();
    return {
      garantia: structuredClone(g),
      cliente: CLIENTES.find((c) => c.id === g.cliente_id)!,
      producto: PRODUCTOS.find((p) => p.id === g.producto_id) ?? null,
      vendedor: USUARIOS.find((u) => u.id === g.vendedor_id) ?? null,
      op_numero: op?.numero ?? "—",
      etapa: this.etapa(g.etapa_id),
      dias: Math.max(
        0,
        Math.floor((fin.getTime() - new Date(g.abierta_en).getTime()) / 86_400_000),
      ),
    };
  }

  async listarGarantias(filtros: GarantiaFiltros = {}): Promise<GarantiaCard[]> {
    const q = filtros.texto?.trim().toLowerCase();
    return this.garantias
      .filter((g) => g.activo)
      .filter((g) =>
        filtros.estado === "abiertas"
          ? !g.cerrada_en
          : filtros.estado === "cerradas"
            ? !!g.cerrada_en
            : true,
      )
      .map((g) => this.garantiaCard(g))
      .filter((c) => {
        if (!q) return true;
        const blob = [
          c.garantia.numero,
          c.cliente.nombre,
          c.producto?.nombre ?? "",
          c.garantia.problema,
          c.op_numero,
          c.vendedor?.nombre ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        // abiertas primero (ambulancia), luego por apertura desc
        const av = a.garantia.cerrada_en ? 1 : 0;
        const bv = b.garantia.cerrada_en ? 1 : 0;
        if (av !== bv) return av - bv;
        return b.garantia.abierta_en.localeCompare(a.garantia.abierta_en);
      });
  }

  async obtenerGarantia(id: string): Promise<GarantiaDetalle | null> {
    const g = this.garantias.find((x) => x.id === id && x.activo);
    if (!g) return null;
    const op = this.ops.find((o) => o.id === g.op_id)!;
    return structuredClone({
      ...this.garantiaCard(g),
      op,
      ciudad: CIUDADES.find((c) => c.id === op.ciudad_id) ?? null,
    });
  }

  async crearGarantia(input: GarantiaCrearInput): Promise<Garantia> {
    const op = this.ops.find((o) => o.id === input.op_id && o.activo);
    if (!op) throw new Error("Seleccione la OP de origen de la garantía");
    if (!input.problema.trim()) throw new Error("Describa la falla reportada");
    const maxNum = Math.max(
      0,
      ...this.garantias.map((g) => Number(g.numero.replace("GR-", "")) || 0),
    );
    const g: Garantia = {
      id: `gr-${crypto.randomUUID().slice(0, 8)}`,
      numero: `GR-${String(maxNum + 1).padStart(4, "0")}`,
      op_id: op.id,
      producto_id: input.producto_id,
      cliente_id: op.cliente_id,
      vendedor_id: input.vendedor_id,
      problema: input.problema.trim(),
      detalle: input.detalle,
      recogida: input.recogida,
      etapa_id: ETAPAS[0].id, // entra a Cola con prioridad ambulancia
      costo_resolucion: null,
      abierta_en: new Date().toISOString(),
      cerrada_en: null,
      activo: true,
      eliminado_en: null,
    };
    this.garantias.push(g);
    return structuredClone(g);
  }

  async actualizarGarantia(
    id: string,
    patch: Partial<
      Pick<Garantia, "recogida" | "costo_resolucion" | "detalle" | "vendedor_id">
    >,
  ): Promise<void> {
    const g = this.garantias.find((x) => x.id === id && x.activo);
    if (!g) throw new Error(`Garantía ${id} no existe`);
    if (patch.costo_resolucion !== undefined && patch.costo_resolucion !== null) {
      if (patch.costo_resolucion < 0) throw new Error("El costo no puede ser negativo");
    }
    Object.assign(g, patch);
  }

  async agregarObservacion(op_id: string, texto: string): Promise<OpObservacion> {
    const obs: OpObservacion = {
      id: Math.max(0, ...this.observaciones.map((o) => o.id)) + 1,
      op_id,
      usuario_id: null,
      texto,
      via: "app",
      en: new Date().toISOString(),
    };
    this.observaciones.push(obs);
    return structuredClone(obs);
  }

  async listarEtapas(): Promise<EtapaProduccion[]> {
    return [...ETAPAS].sort((a, b) => a.orden - b.orden);
  }

  async listarOrigenes(): Promise<OrigenOp[]> {
    return [...ORIGENES];
  }

  async listarCiudades(): Promise<Ciudad[]> {
    return [...CIUDADES];
  }
}

// ---------------------------------------------------------------
// Factory — ÚNICO punto de swap a Supabase
// ---------------------------------------------------------------

const globalRepo = globalThis as unknown as {
  __opsRepositorio?: OpsRepository;
};

/**
 * Devuelve el repositorio de OPs. Hoy: mock en memoria (singleton por
 * runtime, sobrevive HMR). Mañana: `return new SupabaseOpsRepository(...)`.
 */
export function getOpsRepository(): OpsRepository {
  globalRepo.__opsRepositorio ??= new MockOpsRepository();
  return globalRepo.__opsRepositorio;
}
