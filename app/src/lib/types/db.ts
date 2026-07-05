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

/** producto_componentes: BOM / despiece heredado del planner. */
export interface ProductoComponente {
  id: string;
  producto_id: string;
  material_id: string | null; // null si es descriptivo
  categoria: string; // columna, union_perforada, j_lock, barra_pull_up, tornillo…
  descripcion: string;
  cantidad: number;
  longitud_cm: number | null;
  color: string | null;
  color_sigue_rack: boolean;
  visible_cliente: boolean; // false = solo producción
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
  tiempo_entrega: string | null; // 'Fabricados: 45 días hábiles · …'
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
  descuento_pct: number; // por línea: lista tachada → % DESC → subtotal
  alto_override_cm: number | null;
  fondo_override_cm: number | null;
  color: string | null;
  recargos: RecargoAplicado[];
}

/** producto_dimensiones: rango pedible + sobreprecio por cm (planner). */
export interface ProductoDimension {
  id: string;
  producto_id: string;
  eje: "alto" | "fondo";
  min_cm: number;
  max_cm: number;
  default_cm: number;
  precio_por_cm_extra: number; // CON IVA
}

/** Pedido entrante de Shopify (webhook). Pagado → OP automática. */
export interface PedidoWeb {
  id: string;
  shopify_order_id: string; // idempotencia del webhook
  shopify_numero: string; // "#1024"
  cliente_id: string | null; // match/creación por email
  estado_pago: "pagado" | "pendiente" | "reembolsado";
  estado_entrega: "sin_entregar" | "parcial" | "entregado";
  total: number;
  op_id: string | null; // OP generada (null hasta convertir)
  recibido_en: string;
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

// ---- RRHH --------------------------------------------------------

/** Ficha BÁSICA (lo que ven Ops1/Ops2 de los técnicos). */
export interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string | null;
  area: string | null; // 'planta', 'administración'…
  es_tecnico: boolean; // clave para permisos Ops1/Ops2
  fecha_ingreso: string | null;
  activo: boolean;
  eliminado_en: string | null;
}

/** Datos sensibles: SOLO rrhh (Admin) o el propio empleado (RLS propio). */
export interface EmpleadoConfidencial {
  empleado_id: string;
  tipo_contrato: string | null;
  salario_base: number | null;
  eps: string | null;
  arl: string | null;
  hoja_vida_url: string | null;
}

export interface Vacacion {
  id: string;
  empleado_id: string;
  desde: string;
  hasta: string; // regreso calculado con hábiles + festivos
  dias_habiles: number;
  estado: "solicitada" | "aprobada" | "rechazada" | "disfrutada";
  aprobada_por: string | null; // solo Admin aprueba
  notas: string | null;
  creado_en: string;
}

export interface Evaluacion {
  id: string;
  empleado_id: string;
  ciclo: string; // '2026-1'
  puntaje: number | null; // 0–5
  criterios: { nombre: string; puntaje: number }[];
  estado: "pendiente" | "en_curso" | "completada";
  evaluador_id: string | null;
}

export interface Vacante {
  id: string;
  cargo: string;
  area: string | null;
  estado: "abierta" | "pausada" | "cerrada";
  publicada_en: string | null;
  activo: boolean;
  eliminado_en: string | null;
}

export interface Aplicacion {
  id: string;
  vacante_id: string;
  nombre: string;
  contacto: string | null;
  etapa: "aplico" | "entrevista" | "finalista" | "contratado" | "descartado";
  cv_url: string | null;
  creado_en: string;
}

// ---- Cartelera (comunicación interna) ---------------------------

export interface Publicacion {
  id: string;
  autor_id: string;
  tipo: "noticia" | "evento" | "importante";
  titulo: string | null;
  cuerpo: string;
  imagenes: string[]; // URLs en Storage (bucket cartelera)
  evento_fecha: string | null; // solo tipo='evento'
  evento_lugar: string | null;
  importante: boolean;
  fijada: boolean;
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
}

export interface PublicacionComentario {
  id: string;
  publicacion_id: string;
  autor_id: string;
  cuerpo: string;
  imagen_url: string | null;
  activo: boolean;
  creado_en: string;
}

export interface PublicacionReaccion {
  publicacion_id: string;
  usuario_id: string;
  tipo: string; // like, celebra, importante, idea
  en: string;
}

// ---- Inventario y compras ---------------------------------------

export interface TipoMaterial {
  id: number;
  nombre: string; // Tubería, Platinería, Cojinería, Tornillería…
}

export interface Material {
  id: string;
  nombre: string;
  tipo_material_id: number;
  unidad_id: number;
  costo_promedio: number; // promedio ponderado (lo mantiene el kardex)
  buffer_min: number; // Simple Solutions: reposición por consumo
  buffer_max: number;
  activo: boolean;
  eliminado_en: string | null;
}

export interface Proveedor {
  id: string;
  nombre: string;
  nit: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

export interface Existencia {
  id: string;
  producto_id: string | null;
  material_id: string | null;
  tipo: "terminado" | "materia_prima" | "en_proceso";
  cantidad_disponible: number;
  cantidad_reservada: number;
}

export interface MovimientoInventario {
  id: number;
  existencia_id: string;
  tipo:
    | "entrada_compra"
    | "salida_produccion"
    | "entrada_produccion"
    | "salida_venta"
    | "ajuste"
    | "devolucion"
    | "entrada_garantia"
    | "salida_garantia";
  cantidad: number; // entradas > 0, salidas < 0 (lo garantiza la BD)
  costo_unit: number | null; // obligatorio en compras
  op_id: string | null;
  recepcion_id: string | null;
  usuario_id: string | null;
  nota: string | null;
  en: string;
}

export interface SolicitudCompra {
  id: string;
  numero: string; // SC-NNN
  tipo_material_id: number; // 1 renglón por TIPO de material
  proveedor_id: string | null;
  solicitante_id: string;
  estado: "pendiente" | "en_cotizacion" | "comprado" | "rechazada";
  valor_estimado: number | null; // lo digita el comprador al cotizar
  fecha_entrega: string | null; // se habilita al pasar a comprado
  op_id: string | null; // si nace de una OP comercializada
  notas: string | null;
  activo: boolean;
  eliminado_en: string | null;
  creado_en: string;
}

export interface ScItem {
  id: string;
  sc_id: string;
  material_id: string | null;
  descripcion: string | null; // libre si el material aún no existe
  cantidad: number;
}

export interface Recepcion {
  id: string;
  sc_id: string;
  usuario_id: string;
  fecha: string;
  cerrada: boolean; // cierra cuando no quedan faltantes
}

export interface RecepcionItem {
  id: string;
  recepcion_id: string;
  sc_item_id: string;
  cant_recibida: number;
  cant_faltante: number;
  nota: string | null;
  faltante_resuelto: boolean; // seguimiento hasta cierre
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
