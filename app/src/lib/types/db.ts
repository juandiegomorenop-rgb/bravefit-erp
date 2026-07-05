/**
 * Tipos espejo de `supabase/migrations/0001_esquema.sql` (fuente de verdad).
 * Nombres de campos EXACTOS a las columnas SQL (snake_case).
 * Convenciones de mapeo Postgres → TS:
 *   · numeric / integer / identity → number
 *   · date → string "YYYY-MM-DD"
 *   · timestamptz → string ISO 8601
 *   · uuid / text → string
 */

// ---- Catálogos -------------------------------------------------

export interface Ciudad {
  id: number;
  nombre: string;
  departamento: string;
}

export interface EtapaProduccion {
  id: number;
  nombre: string; // En Cola … Instalado
  orden: number;
  es_entrega: boolean; // Entregado (cierra entrega)
  es_terminal: boolean; // Instalado / Entregado sin instalación
  descuenta_mp: boolean; // Corte: descuenta materia prima del BOM
  activo: boolean;
}

export interface OrigenOp {
  id: number;
  clave: string; // 'shopify' | 'whatsapp' | 'planner' | 'cotizacion'
  nombre: string;
  activo: boolean;
}

// ---- Terceros --------------------------------------------------

export interface Cliente {
  id: string;
  tipo: "persona" | "empresa";
  nombre: string;
  nit_cedula: string | null;
  email: string | null;
  telefono: string | null;
  ciudad_id: number | null;
  direccion: string | null;
  canal_preferido: string | null;
  siigo_id: string | null;
  notas: string | null;
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
}

// ---- Productos -------------------------------------------------

export interface Producto {
  id: string;
  sku: string; // BF-PR-001
  sku_siigo: string | null;
  shopify_product_id: string | null;
  nombre: string;
  descripcion: string | null;
  categoria_id: number;
  clasificacion: "MTS" | "ATO" | "MTO";
  origen: "propio" | "comercializado";
  es_rack: boolean; // prioridad de display en OP
  unidad_id: number;
  precio_lista: number; // CON IVA incluido (19%)
  costo_estandar: number | null;
  ancho_cm: number | null;
  profundidad_cm: number | null;
  alto_cm: number | null;
  peso_kg: number | null;
  colores_disponibles: string[];
  color_default: string | null;
  imagen_url: string | null;
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
}

// ---- Producción y logística ------------------------------------

export interface OrdenPedido {
  id: string;
  numero: string; // OP-XXX
  cliente_id: string;
  ciudad_id: number | null;
  segmento: "B2B" | "B2C" | null;
  origen_id: number;
  cotizacion_id: string | null;
  pedido_web_id: string | null;
  etapa_id: number;
  esperando_proveedor: boolean; // sub-estado en Cola (comercializados)
  requiere_instalacion: boolean;
  direccion_entrega: string | null;
  fecha_entrega_pactada: string | null;
  fecha_entregada: string | null; // solo cuando 100% despachado
  mp_descontada_en: string | null;
  notas: string | null;
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
  // SEMÁFORO: calculado siempre desde fecha_entrega_pactada, NUNCA almacenado
}

export interface OpItem {
  id: string;
  op_id: string;
  producto_id: string;
  cantidad: number;
  cantidad_entregada: number; // derivada de op_despachos (trigger)
  precio_unit: number;
  alto_override_cm: number | null;
  fondo_override_cm: number | null;
  color: string | null;
}

export interface OpDespacho {
  id: number;
  op_item_id: string;
  cantidad: number;
  usuario_id: string | null;
  nota: string | null;
  en: string;
}

export interface OpHistorialEtapa {
  id: number;
  op_id: string;
  etapa_id: number;
  usuario_id: string | null;
  nota: string | null;
  en: string;
}

export interface OpObservacion {
  id: number;
  op_id: string;
  usuario_id: string | null;
  texto: string;
  via: "app" | "chat";
  en: string;
}

// ---- Ventas: CRM y cotizaciones ---------------------------------

export interface EtapaCrm {
  id: number;
  nombre: string; // En conversaciones … Ganado / Perdido
  orden: number;
  color: string | null;
  es_ganada: boolean; // dispara OP automática
  es_perdida: boolean;
  activo: boolean;
}

export interface EstadoCotizacion {
  id: number;
  nombre: string; // Borrador, Enviada, Aprobada, Vencida, Anulada
  orden: number;
  activo: boolean;
}

/** usuarios (Supabase Auth es la fuente de identidad). */
export interface Usuario {
  id: string;
  rol_id: number;
  nombre: string;
  email: string;
  activo: boolean;
}

export interface Cotizacion {
  id: string;
  numero: string; // BFP-NNNN (serie del planner)
  cliente_id: string;
  vendedor_id: string;
  segmento: "B2B" | "B2C"; // OBLIGATORIO al crear
  estado_id: number;
  no_facturar: boolean; // NO va a Siigo, SÍ suma a ventas
  descuento_pct: number; // 0–50, solo con pago anticipado completo
  pago_anticipado_completo: boolean;
  valida_hasta: string; // creado + 15 días
  origen: "manual" | "chat" | "planner";
  notas: string | null;
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
}

/** Forma del jsonb cotizacion_items.recargos. */
export interface RecargoAplicado {
  recargo_id: number | null;
  nombre: string; // 'Color no estándar (ATO)'…
  tipo: "pct" | "fijo";
  valor: number; // % (0-100) o COP fijo
  monto: number; // COP resultante por unidad
}

export interface CotizacionItem {
  id: string;
  cotizacion_id: string;
  producto_id: string | null;
  descripcion: string | null; // ítems libres (ej. transporte)
  es_transporte: boolean;
  aplica_iva: boolean; // transporte: elegible sin IVA
  cantidad: number;
  precio_unit: number; // CON IVA si aplica_iva (incluye cm extra + recargos)
  alto_override_cm: number | null;
  fondo_override_cm: number | null;
  color: string | null;
  recargos: RecargoAplicado[];
}

export interface Oportunidad {
  id: string;
  cliente_id: string;
  cotizacion_id: string | null;
  etapa_id: number;
  vendedor_id: string;
  valor_estimado: number | null;
  notas: string | null;
  movida_en: string; // trigger al cambiar de etapa → "días en etapa"
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
}

// ---- Garantías (prioridad ambulancia) ---------------------------

export interface Garantia {
  id: string;
  numero: string; // GR-XXXX
  op_id: string;
  producto_id: string | null;
  cliente_id: string;
  vendedor_id: string | null;
  problema: string;
  detalle: string | null;
  recogida: "por_definir" | "bravefit_recoge" | "cliente_envia";
  etapa_id: number; // mismo flujo que OP (etapas_produccion)
  costo_resolucion: number | null;
  abierta_en: string;
  cerrada_en: string | null;
  activo: boolean;
  eliminado_en: string | null;
}
