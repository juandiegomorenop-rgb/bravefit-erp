-- ============================================================
-- ERP BRAVEFIT · Migración 0001 · Esquema base
-- PostgreSQL 15+ (Supabase). Convenciones:
--   · español snake_case, 3FN, nada duplicado
--   · catálogos parametrizables = tablas (nunca enums de negocio)
--   · uuid para entidades de negocio, identity para catálogos
--   · borrado lógico: activo boolean + eliminado_en
--   · dinero en numeric(14,2) COP · cantidades numeric(12,3)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 0 · NÚCLEO: roles, permisos, usuarios, auditoría
-- ------------------------------------------------------------

create table roles (
  id          smallint generated always as identity primary key,
  nombre      text not null unique,            -- Admin, Operaciones 1, Operaciones 2…
  descripcion text,
  activo      boolean not null default true
);

-- Permisos por rol y módulo. modulo es una clave libre ('ventas',
-- 'produccion', 'rrhh_vacaciones_tecnicos'…): agregar módulos = filas nuevas.
create table permisos (
  id             smallint generated always as identity primary key,
  rol_id         smallint not null references roles(id) on delete cascade,
  modulo         text not null,
  puede_ver      boolean not null default false,
  puede_crear    boolean not null default false,
  puede_editar   boolean not null default false,
  puede_aprobar  boolean not null default false,
  campos_ocultos jsonb not null default '[]'::jsonb,  -- ej. ["salario_base","costo_estandar"]
  unique (rol_id, modulo)
);

-- usuarios.id = auth.users.id (Supabase Auth es la fuente de identidad)
create table usuarios (
  id            uuid primary key references auth.users(id) on delete cascade,
  rol_id        smallint not null references roles(id),
  empleado_id   uuid,                          -- FK diferida (empleados se crea abajo)
  nombre        text not null,
  email         text not null unique,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  ultimo_acceso timestamptz
);

create table auditoria (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references usuarios(id),
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('insert','update','delete')),
  cambios     jsonb,                           -- {campo: {antes, despues}}
  en          timestamptz not null default now()
);
create index idx_auditoria_tabla_registro on auditoria (tabla, registro_id);
create index idx_auditoria_en on auditoria (en desc);

-- ------------------------------------------------------------
-- 0b · Geografía y numeraciones
-- ------------------------------------------------------------

create table ciudades (
  id           smallint generated always as identity primary key,
  nombre       text not null,
  departamento text not null,
  unique (nombre, departamento)
);

-- Festivos de Colombia: insumo del cálculo de vacaciones (días hábiles L–V)
create table festivos (
  fecha  date primary key,
  nombre text not null
);

-- Numeraciones de documentos, parametrizables (prefijo + relleno + siguiente)
create table secuencias (
  clave     text primary key,                  -- 'cotizacion' | 'op' | 'garantia' | 'sc'
  prefijo   text not null,                     -- 'BFP-' | 'OP-' | 'GR-' | 'SC-'
  relleno   smallint not null default 4,       -- ceros a la izquierda
  siguiente integer not null default 1
);

-- Entrega el siguiente número formateado de forma atómica (bloquea la fila).
-- SECURITY DEFINER: el consecutivo lo consume cualquier rol autorizado a crear
-- el documento, aunque no tenga permiso de escritura directa sobre secuencias.
create or replace function fn_siguiente_numero(p_clave text)
returns text language plpgsql
security definer set search_path = public as $$
declare v_num text;
begin
  update secuencias
     set siguiente = siguiente + 1
   where clave = p_clave
   returning prefijo || lpad((siguiente - 1)::text, relleno, '0') into v_num;
  if v_num is null then
    raise exception 'Secuencia % no existe', p_clave;
  end if;
  return v_num;
end $$;

-- ------------------------------------------------------------
-- 1 · CATÁLOGOS PARAMETRIZABLES DE NEGOCIO
-- ------------------------------------------------------------

create table categorias_producto (        -- 1:1 con Shopify
  id     smallint generated always as identity primary key,
  clave  text not null unique,            -- 'racks', 'rigs'…
  nombre text not null,
  orden  smallint not null default 0,
  activo boolean not null default true
);

create table etapas_crm (
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  orden  smallint not null,
  color  text,
  es_ganada  boolean not null default false, -- dispara OP automática
  es_perdida boolean not null default false,
  activo boolean not null default true
);

create table estados_cotizacion (
  id     smallint generated always as identity primary key,
  nombre text not null unique,             -- Borrador, Enviada, Aprobada, Vencida, Anulada
  orden  smallint not null,
  activo boolean not null default true
);

create table etapas_produccion (
  id     smallint generated always as identity primary key,
  nombre text not null unique,             -- En Cola … Instalado
  orden  smallint not null,
  es_entrega   boolean not null default false, -- Entregado (cierra entrega)
  es_terminal  boolean not null default false, -- Instalado / Entregado sin instalación
  descuenta_mp boolean not null default false, -- Corte: descuenta materia prima del BOM
  activo boolean not null default true
);

create table origenes_op (
  id     smallint generated always as identity primary key,
  clave  text not null unique,             -- 'shopify','whatsapp','planner','cotizacion'
  nombre text not null,
  activo boolean not null default true
);

create table tipos_material (
  id     smallint generated always as identity primary key,
  nombre text not null unique,             -- Tubería, Platinería, Cojinería, Tornillería…
  activo boolean not null default true
);

create table unidades_medida (
  id     smallint generated always as identity primary key,
  clave  text not null unique,             -- 'und','m','kg','ml'
  nombre text not null
);

create table colores (                     -- paleta estándar de racks (planner)
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  hex    text,
  activo boolean not null default true
);

create table conceptos_pyg (
  id       smallint generated always as identity primary key,
  nombre   text not null unique,
  orden    smallint not null,
  meta_pct numeric(6,2),                   -- % meta sobre ventas
  mejor_direccion text not null default 'mayor' check (mejor_direccion in ('mayor','menor')),
  activo   boolean not null default true
);

-- ------------------------------------------------------------
-- 2 · TERCEROS
-- ------------------------------------------------------------

create table clientes (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null default 'persona' check (tipo in ('persona','empresa')),
  nombre       text not null,
  nit_cedula   text,
  email        text,
  telefono     text,
  ciudad_id    smallint references ciudades(id),
  direccion    text,
  canal_preferido text,
  siigo_id     text,                       -- id del tercero en Siigo (sync)
  notas        text,
  activo       boolean not null default true,
  eliminado_en timestamptz,
  creado_en    timestamptz not null default now()
);
-- Único: el matching por email del webhook Shopify debe ser determinista
create unique index uq_clientes_email on clientes (lower(email))
  where email is not null and eliminado_en is null;
create index idx_clientes_nombre on clientes using gin (to_tsvector('spanish', nombre));

create table proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  nit       text,
  contacto  text,
  telefono  text,
  email     text,
  activo    boolean not null default true,
  eliminado_en timestamptz,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3 · PRODUCTOS, MATERIALES, BOM, PRECIOS
-- ------------------------------------------------------------

create table productos (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,          -- BF-PR-001 (Bravefit/Shopify)
  sku_siigo     text unique,                   -- alias en Siigo (unificación)
  shopify_product_id text unique,
  nombre        text not null,
  descripcion   text,
  categoria_id  smallint not null references categorias_producto(id),
  clasificacion text not null default 'MTS' check (clasificacion in ('MTS','ATO','MTO')),
  origen        text not null default 'propio' check (origen in ('propio','comercializado')),
  es_rack       boolean not null default false, -- prioridad de display en OP
  unidad_id     smallint not null references unidades_medida(id),
  precio_lista  numeric(14,2) not null default 0,  -- CON IVA incluido (19%)
  costo_estandar numeric(14,2),
  ancho_cm      numeric(8,2),                 -- largo: FIJO de catálogo
  profundidad_cm numeric(8,2),
  alto_cm       numeric(8,2),
  peso_kg       numeric(8,2),
  colores_disponibles text[] not null default '{}',
  color_default text,
  imagen_url    text,
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  creado_en     timestamptz not null default now()
);
create index idx_productos_categoria on productos (categoria_id);

-- Dimensiones variables (planner): rango pedible + sobreprecio por cm
create table producto_dimensiones (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  eje         text not null check (eje in ('alto','fondo')),
  min_cm      numeric(8,2) not null,
  max_cm      numeric(8,2) not null,
  default_cm  numeric(8,2) not null,
  precio_por_cm_extra numeric(14,2) not null default 0, -- CON IVA
  unique (producto_id, eje),
  check (min_cm <= default_cm and default_cm <= max_cm)
);

-- Recargos premium parametrizables (personalización ATO/MTO: color, accesorio…)
create table recargos (
  id          smallint generated always as identity primary key,
  nombre      text not null,                  -- 'Color no estándar', 'Instalación'…
  tipo        text not null default 'pct' check (tipo in ('pct','fijo')),
  valor       numeric(14,4) not null,         -- % (0-100) o COP fijo
  aplica_a    text not null default 'item' check (aplica_a in ('item','total')),
  activo      boolean not null default true
);

create table materiales (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  tipo_material_id smallint not null references tipos_material(id),
  unidad_id        smallint not null references unidades_medida(id),
  costo_promedio   numeric(14,4) not null default 0,  -- promedio ponderado (kardex)
  -- Buffers Simple Solutions (reposición por consumo)
  buffer_min       numeric(12,3) not null default 0,
  buffer_max       numeric(12,3) not null default 0,
  activo           boolean not null default true,
  eliminado_en     timestamptz,
  unique (nombre, tipo_material_id)
);

-- BOM / despiece (estructura heredada del planner)
create table producto_componentes (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references productos(id) on delete cascade,
  material_id     uuid references materiales(id),      -- null si es descriptivo
  categoria       text not null default 'otro',        -- columna, union_perforada, j_lock, barra_pull_up, tornillo…
  descripcion     text not null,
  cantidad        numeric(12,3) not null,
  longitud_cm     numeric(8,2),
  color           text,
  color_sigue_rack boolean not null default true,
  visible_cliente boolean not null default true        -- false = solo producción
);
create index idx_bom_producto on producto_componentes (producto_id);

create table catalogos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  categoria   text,                     -- 'General','Racks','Cardio','Lista de precios'…
  portada_url text,
  publicado   boolean not null default false,
  activo      boolean not null default true,
  eliminado_en timestamptz,
  creado_en   timestamptz not null default now()
);

create table catalogo_productos (
  catalogo_id uuid not null references catalogos(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  orden       smallint not null default 0,
  primary key (catalogo_id, producto_id)
);

-- Versiones de archivo de cada catálogo: los vendedores SIEMPRE consumen la
-- versión de mayor número (la actual); las anteriores quedan como historial.
create table catalogo_versiones (
  id             uuid primary key default gen_random_uuid(),
  catalogo_id    uuid not null references catalogos(id) on delete cascade,
  version        smallint not null,               -- 1,2,3… correlativo por catálogo
  archivo_url    text not null,                   -- ruta en el bucket 'catalogos'
  archivo_nombre text not null,                   -- nombre original del PDF
  tamano_bytes   bigint,
  notas          text,                            -- p. ej. "Actualización de precios julio"
  subido_por     uuid references usuarios(id),
  subido_en      timestamptz not null default now(),
  unique (catalogo_id, version)
);
create index idx_catver_catalogo on catalogo_versiones (catalogo_id, version desc);

-- ------------------------------------------------------------
-- 4 · VENTAS: cotizaciones, CRM, Shopify
-- ------------------------------------------------------------

create table cotizaciones (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,              -- BFP-NNNN
  cliente_id    uuid not null references clientes(id),
  vendedor_id   uuid not null references usuarios(id),
  segmento      text not null check (segmento in ('B2B','B2C')),  -- OBLIGATORIO al crear
  estado_id     smallint not null references estados_cotizacion(id),
  no_facturar   boolean not null default false,    -- NO va a Siigo, SÍ suma a ventas
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 50),
  pago_anticipado_completo boolean not null default false,
  valida_hasta  date not null,                     -- creado + 15 días (default en app)
  tiempo_entrega text,                             -- 'Fabricados: 45 días hábiles · Comercializados: 3 a 7 días hábiles'
  origen        text not null default 'manual' check (origen in ('manual','chat','planner')),
  -- la factura Siigo vive en la tabla facturas (una cotización puede tener varias)
  notas         text,
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  creado_en     timestamptz not null default now(),
  check (valida_hasta >= creado_en::date)
);
create index idx_cotizaciones_cliente on cotizaciones (cliente_id);
create index idx_cotizaciones_estado on cotizaciones (estado_id);
create index idx_cotizaciones_creado on cotizaciones (creado_en desc);
create index idx_cotizaciones_vendedor on cotizaciones (vendedor_id);

create table cotizacion_items (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  producto_id   uuid references productos(id),
  descripcion   text,                              -- libre para ítems no catalogados (ej. transporte)
  es_transporte boolean not null default false,
  aplica_iva    boolean not null default true,     -- transporte: elegible sin IVA
  cantidad      numeric(12,3) not null check (cantidad > 0),
  precio_unit   numeric(14,2) not null check (precio_unit >= 0), -- CON IVA si aplica_iva
  -- Formato aprobado de cotización: descuento POR LÍNEA (precio de lista
  -- tachado → columna % DESC → subtotal con descuento)
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  alto_override_cm  numeric(8,2),
  fondo_override_cm numeric(8,2),
  color         text,
  recargos      jsonb not null default '[]'::jsonb, -- [{recargo_id,nombre,tipo,valor,monto}]
  check (producto_id is not null or descripcion is not null)
);
create index idx_cotitems_cotizacion on cotizacion_items (cotizacion_id);
create index idx_cotitems_producto on cotizacion_items (producto_id);

create table oportunidades (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references clientes(id),
  cotizacion_id  uuid references cotizaciones(id),
  etapa_id       smallint not null references etapas_crm(id),
  vendedor_id    uuid not null references usuarios(id),
  valor_estimado numeric(14,2),
  notas          text,
  movida_en      timestamptz not null default now(),
  activo         boolean not null default true,
  eliminado_en   timestamptz,
  creado_en      timestamptz not null default now()
);
create index idx_oportunidades_etapa on oportunidades (etapa_id);
create index idx_oportunidades_cliente on oportunidades (cliente_id);
create index idx_oportunidades_vendedor on oportunidades (vendedor_id);
create index idx_oportunidades_cotizacion on oportunidades (cotizacion_id);

create table pedidos_web (
  id               uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,           -- idempotencia del webhook
  shopify_numero   text,
  cliente_id       uuid references clientes(id),   -- match/creación por email
  estado_pago      text not null,
  estado_entrega   text,
  total            numeric(14,2) not null default 0,
  op_id            uuid,                           -- FK diferida a ordenes_pedido
  payload          jsonb not null,                 -- respaldo íntegro del webhook
  recibido_en      timestamptz not null default now()
);
create index idx_pedidosweb_op on pedidos_web (op_id);
create index idx_pedidosweb_cliente on pedidos_web (cliente_id);

-- Métricas diarias de la tienda (para la pestaña Analítica estilo Shopify)
create table shopify_metricas_diarias (
  fecha      date primary key,
  sesiones   integer not null default 0,
  ventas     numeric(14,2) not null default 0,
  pedidos    integer not null default 0,
  conversion numeric(6,4) not null default 0
);

-- ------------------------------------------------------------
-- 5 · PRODUCCIÓN Y LOGÍSTICA
-- ------------------------------------------------------------

create table ordenes_pedido (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,              -- OP-XXX
  cliente_id    uuid not null references clientes(id),
  ciudad_id     smallint references ciudades(id),
  segmento      text check (segmento in ('B2B','B2C')), -- lo copia de la cotización o lo fija el origen
  origen_id     smallint not null references origenes_op(id),
  cotizacion_id uuid references cotizaciones(id),
  pedido_web_id uuid references pedidos_web(id),
  vendedor_id   uuid references usuarios(id),        -- vendedor real: heredado de la cotización o fijado por el origen (Shopify → null)
  etapa_id      smallint not null references etapas_produccion(id),
  esperando_proveedor boolean not null default false, -- sub-estado en Cola (comercializados)
  requiere_instalacion boolean not null default false,
  direccion_entrega text,
  fecha_entrega_pactada date,
  fecha_entregada       date,                      -- solo cuando 100% despachado (trigger lo garantiza)
  mp_descontada_en timestamptz,                    -- idempotencia del descuento de BOM:
                                                   -- se estampa una sola vez al entrar a Corte
  notas         text,
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  creado_en     timestamptz not null default now()
  -- SEMÁFORO: calculado siempre desde fecha_entrega_pactada, NUNCA almacenado
);
create index idx_op_etapa on ordenes_pedido (etapa_id);
create index idx_op_cliente on ordenes_pedido (cliente_id);
create index idx_op_cotizacion on ordenes_pedido (cotizacion_id);
create index idx_op_pedido_web on ordenes_pedido (pedido_web_id);
-- Parciales: el semáforo/dashboard consulta OPs abiertas; Entregas consulta cerradas
create index idx_op_abiertas on ordenes_pedido (fecha_entrega_pactada)
  where activo and fecha_entregada is null;
create index idx_op_entregadas on ordenes_pedido (fecha_entregada)
  where fecha_entregada is not null;

alter table pedidos_web
  add constraint fk_pedidos_web_op foreign key (op_id) references ordenes_pedido(id);

create table op_items (
  id           uuid primary key default gen_random_uuid(),
  op_id        uuid not null references ordenes_pedido(id) on delete cascade,
  producto_id  uuid not null references productos(id),
  cantidad     numeric(12,3) not null check (cantidad > 0),
  cantidad_entregada numeric(12,3) not null default 0 check (cantidad_entregada >= 0),
  precio_unit  numeric(14,2) not null check (precio_unit >= 0),
  alto_override_cm  numeric(8,2),
  fondo_override_cm numeric(8,2),
  color        text,
  check (cantidad_entregada <= cantidad)           -- entregas parciales controladas
);
create index idx_opitems_op on op_items (op_id);
create index idx_opitems_producto on op_items (producto_id);

-- Despachos por evento: trazabilidad de cada entrega parcial (cuándo, cuánto,
-- quién). cantidad_entregada de op_items se DERIVA de aquí vía trigger.
create table op_despachos (
  id          bigint generated always as identity primary key,
  op_item_id  uuid not null references op_items(id) on delete cascade,
  cantidad    numeric(12,3) not null check (cantidad > 0),
  usuario_id  uuid references usuarios(id),
  nota        text,
  en          timestamptz not null default now()
);
create index idx_despachos_item on op_despachos (op_item_id);

create table op_historial_etapas (
  id         bigint generated always as identity primary key,
  op_id      uuid not null references ordenes_pedido(id) on delete cascade,
  etapa_id   smallint not null references etapas_produccion(id),
  usuario_id uuid references usuarios(id),
  nota       text,
  en         timestamptz not null default now()
);
create index idx_ophist_op on op_historial_etapas (op_id, en);

-- Observaciones/comentarios de OP (también las agregará el chat Claude fase 2)
create table op_observaciones (
  id         bigint generated always as identity primary key,
  op_id      uuid not null references ordenes_pedido(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  texto      text not null,
  via        text not null default 'app' check (via in ('app','chat')),
  en         timestamptz not null default now()
);

-- ---- Inventario (una sola bodega) --------------------------

-- Los saldos NUNCA se escriben desde la app: los actualiza el trigger del
-- kardex (fn_aplicar_movimiento) de forma atómica. Los CHECK >= 0 abortan
-- cualquier movimiento que dejaría stock negativo.
create table existencias (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id),
  material_id uuid references materiales(id),
  tipo        text not null check (tipo in ('terminado','materia_prima','en_proceso')),
  cantidad_disponible numeric(12,3) not null default 0 check (cantidad_disponible >= 0),
  cantidad_reservada  numeric(12,3) not null default 0 check (cantidad_reservada >= 0),
  -- coherencia tipo/entidad: materiales solo materia_prima; productos terminado/en_proceso
  check ((material_id is not null and producto_id is null and tipo = 'materia_prima')
      or (producto_id is not null and material_id is null and tipo in ('terminado','en_proceso'))),
  unique (producto_id, tipo),
  unique (material_id, tipo)
);

-- Kardex INMUTABLE: no se edita ni borra; toda corrección es un 'ajuste' nuevo.
create table movimientos_inventario (
  id            bigint generated always as identity primary key,
  existencia_id uuid not null references existencias(id),
  tipo          text not null check (tipo in ('entrada_compra','salida_produccion','entrada_produccion','salida_venta','ajuste','devolucion','entrada_garantia','salida_garantia')),
  cantidad      numeric(12,3) not null,
  costo_unit    numeric(14,4),                    -- obligatorio en compras (check abajo)
  op_id         uuid references ordenes_pedido(id),
  recepcion_id  uuid,                             -- FK diferida
  usuario_id    uuid references usuarios(id),
  nota          text,
  en            timestamptz not null default now(),
  check (cantidad <> 0),
  -- el signo lo garantiza la BD, no la app: entradas > 0, salidas < 0, ajuste libre
  check (case
           when tipo in ('entrada_compra','entrada_produccion','devolucion','entrada_garantia') then cantidad > 0
           when tipo in ('salida_produccion','salida_venta','salida_garantia') then cantidad < 0
           else true
         end),
  check (tipo <> 'entrada_compra' or costo_unit is not null)
);
create index idx_movinv_existencia on movimientos_inventario (existencia_id, en desc);
create index idx_movinv_op on movimientos_inventario (op_id);
create index idx_movinv_recepcion on movimientos_inventario (recepcion_id);

-- Consumo mensual por material (alimenta buffers y tendencias) = vista, no tabla

-- ---- Solicitudes de compra ---------------------------------

create table solicitudes_compra (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,          -- SC-NNN
  tipo_material_id smallint not null references tipos_material(id),
  proveedor_id     uuid references proveedores(id),
  solicitante_id   uuid not null references usuarios(id),
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente','en_cotizacion','comprado','rechazada')),
  valor_estimado   numeric(14,2),                 -- lo digita el comprador al cotizar
  fecha_entrega    date,                          -- se habilita al pasar a comprado
  op_id            uuid references ordenes_pedido(id),  -- si nace de una OP comercializada
  notas            text,
  activo           boolean not null default true,
  eliminado_en     timestamptz,
  creado_en        timestamptz not null default now()
);
create index idx_sc_estado on solicitudes_compra (estado);

create table sc_items (
  id          uuid primary key default gen_random_uuid(),
  sc_id       uuid not null references solicitudes_compra(id) on delete cascade,
  material_id uuid references materiales(id),
  descripcion text,                                -- libre si el material aún no existe
  cantidad    numeric(12,3) not null check (cantidad > 0),
  check (material_id is not null or descripcion is not null)
);

create table recepciones (
  id         uuid primary key default gen_random_uuid(),
  sc_id      uuid not null references solicitudes_compra(id),
  usuario_id uuid not null references usuarios(id),
  fecha      timestamptz not null default now(),
  cerrada    boolean not null default false        -- cierra cuando no quedan faltantes
);
create index idx_recepciones_sc on recepciones (sc_id);

alter table movimientos_inventario
  add constraint fk_movinv_recepcion foreign key (recepcion_id) references recepciones(id);

create table recepcion_items (
  id             uuid primary key default gen_random_uuid(),
  recepcion_id   uuid not null references recepciones(id) on delete cascade,
  sc_item_id     uuid not null references sc_items(id),
  cant_recibida  numeric(12,3) not null default 0 check (cant_recibida >= 0),
  cant_faltante  numeric(12,3) not null default 0 check (cant_faltante >= 0),
  nota           text,
  faltante_resuelto boolean not null default false -- seguimiento hasta cierre
);
create index idx_recitems_recepcion on recepcion_items (recepcion_id);
create index idx_recitems_scitem on recepcion_items (sc_item_id);

-- ---- Garantías (prioridad ambulancia) ----------------------

create table garantias (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,              -- GR-XXXX
  op_id         uuid not null references ordenes_pedido(id),
  producto_id   uuid references productos(id),
  cliente_id    uuid not null references clientes(id),
  vendedor_id   uuid references usuarios(id),      -- contacto ante dudas
  -- # cotización y # factura NO se duplican como texto: se derivan de la OP
  -- (op → cotizacion → numero) y de la tabla facturas (op_id / cotizacion_id)
  problema      text not null,
  detalle       text,
  recogida      text not null default 'por_definir'
                check (recogida in ('por_definir','bravefit_recoge','cliente_envia')),
  etapa_id      smallint not null references etapas_produccion(id), -- mismo flujo que OP
  costo_resolucion numeric(14,2),
  abierta_en    timestamptz not null default now(),
  cerrada_en    timestamptz,
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  check (cerrada_en is null or cerrada_en >= abierta_en)
);
create index idx_garantias_abierta on garantias (abierta_en desc);
create index idx_garantias_etapa on garantias (etapa_id);
create index idx_garantias_op on garantias (op_id);

-- Los movimientos de inventario de una garantía se cuelgan DE LA GARANTÍA
-- (una OP puede tener varias GR-XXXX; op_id solo sería ambiguo). Esto
-- sustenta costo_resolucion con el kardex real de la reparación.
alter table movimientos_inventario
  add column garantia_id uuid references garantias(id);
create index idx_movinv_garantia on movimientos_inventario (garantia_id);

-- ------------------------------------------------------------
-- 6 · MERCADEO
-- ------------------------------------------------------------

-- MODELO GENÉRICO POR TIPO, no por plataforma (spec Mercadeo v4):
-- la plataforma es un campo (canal_id), no una tabla nueva. Las métricas
-- son SERIE DE TIEMPO (una fila por día) → filtros 7/30/90 días sin
-- reprocesar. Campos específicos de plataforma van en atributos_extra jsonb.

-- 6.1 · Catálogo de canales (tabla pequeña y fija)
create table canales (
  id               smallint generated always as identity primary key,
  nombre           text not null unique,        -- Instagram, Meta Ads, Google Ads…
  tipo             text not null check (tipo in ('organico','pauta','mensajeria')),
  estado           text not null default 'planeado'
                   check (estado in ('activo','planeado','inactivo')),
  fecha_activacion date
);

create table cuentas_conectadas (
  id             uuid primary key default gen_random_uuid(),
  canal_id       smallint not null references canales(id),
  nombre_cuenta  text not null,                 -- @bravefit, cuenta Meta Ads…
  id_externo     text,                          -- IG Business Account ID, Ad Account ID
  access_token_ref text,                        -- REFERENCIA al secreto, NUNCA el token en claro
  token_expira   timestamptz,                   -- alertar renovación antes de caducar
  estado_conexion text not null default 'ok'
                 check (estado_conexion in ('ok','token_vencido','permiso_revocado','en_revision')),
  activo         boolean not null default true
);

-- 6.2 · Contenido orgánico (genérico, cualquier canal orgánico)
create table contenido (
  id                 uuid primary key default gen_random_uuid(),
  cuenta_id          uuid not null references cuentas_conectadas(id),
  id_externo         text,
  tipo_formato       text not null check (tipo_formato in ('reel','carrusel','estatico','story','video')),
  categoria_producto text,                       -- Racks, Fuerza… (catálogo Bravefit)
  fecha_publicacion  timestamptz,
  url_publica        text,
  miniatura_url      text,
  segmento           text check (segmento in ('B2B','B2C','ambos')),
  cumple_tono_marca  boolean,                    -- check manual opcional
  titulo             text,                       -- descripción interna
  activo             boolean not null default true
);
create index idx_contenido_cuenta on contenido (cuenta_id);
create index idx_contenido_fecha on contenido (fecha_publicacion desc);

-- 6.3 · Métricas diarias de contenido (corazón del Top-3 filtrable)
create table contenido_metricas_diarias (
  id               bigint generated always as identity primary key,
  contenido_id     uuid not null references contenido(id) on delete cascade,
  fecha            date not null,
  alcance          integer not null default 0,
  alcance_no_seguidores integer not null default 0,  -- tasa de descubrimiento
  impresiones      integer not null default 0,
  likes            integer not null default 0,
  comentarios      integer not null default 0,
  compartidos      integer not null default 0,
  guardados        integer not null default 0,
  clics_perfil     integer not null default 0,
  clics_whatsapp   integer not null default 0,       -- conversión real en orgánico
  retencion_video_pct numeric(5,2),                  -- solo video/reel
  atributos_extra  jsonb not null default '{}'::jsonb,
  unique (contenido_id, fecha)
  -- tasa_interaccion y engagement_score: se calculan en consulta (sección 5)
);
create index idx_contmet_fecha on contenido_metricas_diarias (fecha);

-- 6.4 · Pauta: campaña → conjunto → anuncio (Meta/Google/TikTok, mismo modelo)
create table campanas (
  id                uuid primary key default gen_random_uuid(),
  canal_id          smallint not null references canales(id),
  cuenta_id         uuid references cuentas_conectadas(id),
  id_externo        text,
  nombre            text not null,
  objetivo          text check (objetivo in ('trafico','mensajes','conversion','alcance','leads')),
  presupuesto_diario numeric(14,2),
  fecha_inicio      date,
  fecha_fin         date,
  segmento          text check (segmento in ('B2B','B2C','ambos')),
  utm_campaign      text,                        -- = nombre normalizado (sección 6)
  activo            boolean not null default true,
  eliminado_en      timestamptz,
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);
create index idx_campanas_canal on campanas (canal_id);

create table conjuntos_anuncios (
  id         uuid primary key default gen_random_uuid(),
  campana_id uuid not null references campanas(id) on delete cascade,
  id_externo text,
  nombre     text not null,
  activo     boolean not null default true
);
create index idx_conjuntos_campana on conjuntos_anuncios (campana_id);

create table anuncios (
  id            uuid primary key default gen_random_uuid(),
  conjunto_id   uuid not null references conjuntos_anuncios(id) on delete cascade,
  contenido_id  uuid references contenido(id),   -- si el creativo es un post orgánico
  id_externo    text,
  nombre        text,
  tipo_creativo text,
  angulo_mensaje text,                            -- 'precio','durabilidad','antes/después'…
  activo        boolean not null default true
);
create index idx_anuncios_conjunto on anuncios (conjunto_id);
create index idx_anuncios_contenido on anuncios (contenido_id);

-- 6.5 · Métricas diarias de pauta (serie de tiempo)
create table pauta_metricas_diarias (
  id                bigint generated always as identity primary key,
  anuncio_id        uuid not null references anuncios(id) on delete cascade,
  fecha             date not null,
  impresiones       integer not null default 0,
  clics             integer not null default 0,
  clics_salida      integer not null default 0,   -- outbound ≠ link click
  gasto             numeric(14,2) not null default 0,
  frecuencia        numeric(8,2),
  resultados        integer not null default 0,    -- según objetivo (mensajes, leads…)
  costo_por_resultado numeric(14,2),
  atributos_extra   jsonb not null default '{}'::jsonb,  -- ej. hook_rate (video)
  unique (anuncio_id, fecha)
);
create index idx_pautamet_fecha on pauta_metricas_diarias (fecha);

-- 6.6 · LEADS: puente marketing ↔ ventas (la tabla más importante).
-- Convierte "costo por clic" en CAC y ROAS reales al enlazar con cotizaciones.
create table leads (
  id             uuid primary key default gen_random_uuid(),
  fecha_creacion timestamptz not null default now(),
  canal_id       smallint references canales(id),
  campana_id     uuid references campanas(id),
  contenido_id   uuid references contenido(id),
  cliente_id     uuid references clientes(id),
  cotizacion_id  uuid references cotizaciones(id),  -- → módulo cotizaciones
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  segmento       text check (segmento in ('B2B','B2C')),
  estado         text not null default 'nuevo'
                 check (estado in ('nuevo','cotizado','cerrado_ganado','cerrado_perdido')),
  valor_cierre   numeric(14,2),                    -- ticket real si cerró
  margen_producto_pct numeric(5,2)
);
create index idx_leads_canal on leads (canal_id);
create index idx_leads_campana on leads (campana_id);
create index idx_leads_estado on leads (estado);
create index idx_leads_fecha on leads (fecha_creacion desc);

-- 6.7 · Bitácora A/B de aprendizajes creativos
create table pruebas_creativas (
  id            uuid primary key default gen_random_uuid(),
  fecha_inicio  date,
  fecha_fin     date,
  hipotesis     text not null,
  variantes     jsonb not null default '[]'::jsonb,  -- IDs de anuncios/contenidos
  resultado     text,
  se_aplico     boolean not null default false
);

-- 6.8 · WhatsApp (Fase 4 — el modelo ya las soporta; monitorear calidad)
create table whatsapp_plantillas (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  categoria           text check (categoria in ('marketing','utility','authentication')),
  estado_aprobacion   text not null default 'en_revision'
                      check (estado_aprobacion in ('aprobada','rechazada','en_revision')),
  fecha_envio_revision date,
  cuerpo              text
);

create table whatsapp_campanas_masivas (
  id                    uuid primary key default gen_random_uuid(),
  fecha_envio           timestamptz not null default now(),
  plantilla_id          uuid references whatsapp_plantillas(id),
  categoria_plantilla   text check (categoria_plantilla in ('marketing','utility','authentication')),
  segmento_destinatarios text,
  enviados              integer not null default 0,
  entregados            integer not null default 0,
  leidos                integer not null default 0,
  respondidos           integer not null default 0,
  optout                integer not null default 0,   -- crítico para la calidad
  costo_total           numeric(14,2) not null default 0
);

create table whatsapp_cuenta_salud (               -- una fila por día
  fecha                date primary key,
  quality_rating       text check (quality_rating in ('alta','media','baja')),
  tier_mensajeria      integer,                     -- límite conversaciones/día
  plantillas_aprobadas integer not null default 0,
  plantillas_rechazadas integer not null default 0
);

create table encuestas (
  id        uuid primary key default gen_random_uuid(),
  titulo    text not null,
  canal     text,
  preguntas jsonb not null default '[]'::jsonb,
  activa    boolean not null default true,
  creado_en timestamptz not null default now()
);

create table encuesta_respuestas (
  id          uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references encuestas(id) on delete cascade,
  cliente_id  uuid references clientes(id),
  op_id       uuid references ordenes_pedido(id),   -- post-entrega
  respuestas  jsonb not null,
  en          timestamptz not null default now()
);
create index idx_encresp_op on encuesta_respuestas (op_id);
-- (redes_metricas legacy eliminada: contenido + contenido_metricas_diarias
--  cubren visualizaciones/engagement/top-post con más detalle)

-- ------------------------------------------------------------
-- 7 · RECURSOS HUMANOS Y CARTELERA
-- ------------------------------------------------------------

-- Ficha BÁSICA: lo que Ops1/Ops2 pueden ver de los técnicos.
-- Lo sensible vive en empleados_confidencial con RLS propio: la separación
-- es a nivel de BD, no de API (PostgREST directo tampoco expone salarios).
create table empleados (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  cedula        text not null unique,
  cargo         text,
  area          text,                              -- 'planta', 'administración'…
  es_tecnico    boolean not null default false,    -- clave para permisos Ops1/Ops2
  fecha_ingreso date,
  activo        boolean not null default true,
  eliminado_en  timestamptz
);

create table empleados_confidencial (
  empleado_id   uuid primary key references empleados(id) on delete cascade,
  tipo_contrato text,
  salario_base  numeric(14,2),
  eps           text,
  arl           text,
  hoja_vida_url text                               -- PDF en Storage
);

alter table usuarios
  add constraint fk_usuarios_empleado foreign key (empleado_id) references empleados(id);

-- Nómina VIVE EN SIIGO por ahora. Tabla prevista para absorberla algún día.
create table nominas (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  periodo     text not null check (periodo ~ '^\d{4}-\d{2}$'),  -- '2026-07'
  devengos    jsonb not null default '{}'::jsonb,
  deducciones jsonb not null default '{}'::jsonb,
  neto        numeric(14,2),
  liquidada_en timestamptz,
  unique (empleado_id, periodo)
);

create table vacaciones (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references empleados(id),
  desde        date not null,
  hasta        date not null,                      -- regreso calculado con hábiles+festivos
  dias_habiles smallint not null,
  estado       text not null default 'solicitada'
               check (estado in ('solicitada','aprobada','rechazada','disfrutada')),
  aprobada_por uuid references usuarios(id),       -- solo Admin aprueba
  notas        text,
  creado_en    timestamptz not null default now(),
  check (hasta >= desde)
);
create index idx_vacaciones_empleado on vacaciones (empleado_id);

create table evaluaciones (
  id           uuid primary key default gen_random_uuid(),
  empleado_id  uuid not null references empleados(id),
  ciclo        text not null check (ciclo ~ '^\d{4}-[12]$'),  -- '2026-1'
  puntaje      numeric(3,2) check (puntaje between 0 and 5),
  criterios    jsonb not null default '[]'::jsonb,
  estado       text not null default 'pendiente'
               check (estado in ('pendiente','en_curso','completada')),
  evaluador_id uuid references usuarios(id),
  unique (empleado_id, ciclo)
);

create table vacantes (
  id           uuid primary key default gen_random_uuid(),
  cargo        text not null,
  area         text,
  estado       text not null default 'abierta' check (estado in ('abierta','pausada','cerrada')),
  publicada_en date,
  activo       boolean not null default true,
  eliminado_en timestamptz
);

create table aplicaciones (
  id         uuid primary key default gen_random_uuid(),
  vacante_id uuid not null references vacantes(id) on delete cascade,
  nombre     text not null,
  contacto   text,
  etapa      text not null default 'aplico'
             check (etapa in ('aplico','entrevista','finalista','contratado','descartado')),
  cv_url     text,
  creado_en  timestamptz not null default now()
);

-- Cartelera: todos publican, comentan y reaccionan (incluye imágenes)
create table publicaciones (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references usuarios(id),
  tipo       text not null default 'noticia'
             check (tipo in ('noticia','evento','importante')),
  titulo     text,
  cuerpo     text not null,
  imagenes   jsonb not null default '[]'::jsonb,  -- URLs en Storage (bucket cartelera)
  evento_fecha timestamptz,                        -- solo tipo='evento'
  evento_lugar text,
  importante boolean not null default false,       -- resaltar (comité, urgente)
  fijada     boolean not null default false,       -- se ancla arriba
  activo     boolean not null default true,
  eliminado_en timestamptz,
  creado_en  timestamptz not null default now()
);
create index idx_publicaciones_creado on publicaciones (creado_en desc);

create table publicacion_comentarios (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references publicaciones(id) on delete cascade,
  autor_id       uuid not null references usuarios(id),
  cuerpo         text not null,
  imagen_url     text,                             -- imagen opcional en el comentario
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);
create index idx_comentarios_publicacion on publicacion_comentarios (publicacion_id, creado_en);

create table publicacion_reacciones (
  publicacion_id uuid not null references publicaciones(id) on delete cascade,
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  tipo           text not null default 'like',     -- like, celebra, importante, idea
  en             timestamptz not null default now(),
  primary key (publicacion_id, usuario_id, tipo)
);

create table eventos (
  id     uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha  timestamptz not null,
  lugar  text,
  activo boolean not null default true
);

-- ------------------------------------------------------------
-- 8 · FINANZAS (PyG manual) E INTEGRACIONES
-- ------------------------------------------------------------

-- REGLA DEL DUEÑO: el PyG NO se calcula. Gerencia lo carga (captura o Excel).
create table pyg_mensual (
  id          bigint generated always as identity primary key,
  periodo     text not null check (periodo ~ '^\d{4}-\d{2}$'),  -- '2026-04'
  concepto_id smallint not null references conceptos_pyg(id),
  valor       numeric(16,2) not null,
  cargado_por uuid references usuarios(id),
  en          timestamptz not null default now(),
  unique (periodo, concepto_id)
);

create table nivel_servicio_mensual (              -- pestaña Operación del dashboard
  periodo     text primary key check (periodo ~ '^\d{4}-\d{2}$'),  -- '2026-04'
  cumplidos   integer not null default 0,
  incumplidos integer not null default 0,
  observaciones text,
  cargado_por uuid references usuarios(id)
);

-- Facturas emitidas en Siigo (Siigo es la autoridad fiscal; aquí solo el vínculo).
-- Vive aparte de cotizaciones porque una OP Shopify/WhatsApp no tiene cotización
-- y necesita dónde registrar su factura. REGLA DE NEGOCIO: una venta PP = UNA
-- factura con DOS pagos (anticipo 60% + saldo 40%, ver tabla pagos) — NO dos
-- facturas. Si algún día hay más de una factura por venta será por casos
-- excepcionales (refacturación/nota), no por el esquema de pago.
create table facturas (
  id            uuid primary key default gen_random_uuid(),
  siigo_id      text unique,                      -- id del documento en Siigo
  numero        text unique,                      -- número fiscal devuelto por Siigo
  cotizacion_id uuid references cotizaciones(id),
  op_id         uuid references ordenes_pedido(id),
  total         numeric(14,2),
  emitida_en    timestamptz,
  creado_en     timestamptz not null default now(),
  check (num_nonnulls(cotizacion_id, op_id) >= 1)
);
create index idx_facturas_cotizacion on facturas (cotizacion_id);
create index idx_facturas_op on facturas (op_id);

-- Pagos/abonos recibidos: una venta PP tiene UNA factura y DOS pagos
-- (anticipo 60% + saldo 40% antes de entrega). Siigo lleva la cartera
-- oficial; esto responde "¿debe saldo?" ANTES de despachar sin salir
-- del ERP. fuente='siigo' cuando lo trae el sync.
create table pagos (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references cotizaciones(id),
  op_id         uuid references ordenes_pedido(id),
  factura_id    uuid references facturas(id),
  concepto      text not null default 'abono'
                check (concepto in ('anticipo','saldo','abono','total')),
  monto         numeric(14,2) not null check (monto > 0),
  medio         text,                             -- transferencia, pasarela, efectivo…
  fuente        text not null default 'manual'
                check (fuente in ('manual','siigo','shopify')),
  recibido_en   date not null default current_date,
  usuario_id    uuid references usuarios(id),
  nota          text,
  check (num_nonnulls(cotizacion_id, op_id, factura_id) >= 1)
);
create index idx_pagos_cotizacion on pagos (cotizacion_id);
create index idx_pagos_op on pagos (op_id);
create index idx_pagos_factura on pagos (factura_id);

-- Cola de integraciones: webhooks entran aquí; un worker los procesa.
create table integracion_eventos (
  id           bigint generated always as identity primary key,
  sistema      text not null check (sistema in ('shopify','siigo','whatsapp','planner')),
  tipo_evento  text not null,
  clave_externa text,                              -- ej. shopify_order_id (idempotencia)
  payload      jsonb not null,
  estado       text not null default 'pendiente'
               check (estado in ('pendiente','procesando','procesado','error','descartado')),
  intentos     smallint not null default 0,
  ultimo_error text,
  recibido_en  timestamptz not null default now(),
  procesado_en timestamptz
);
-- Idempotencia: unique PARCIAL (un unique de tabla no aplica entre NULLs).
-- Eventos sin clave externa NO se deduplican: el worker debe exigir clave
-- en shopify/siigo y solo permitir null en eventos manuales/planner.
create unique index uq_integracion_evento on integracion_eventos
  (sistema, tipo_evento, clave_externa) where clave_externa is not null;
create index idx_integracion_pendientes on integracion_eventos (estado, recibido_en)
  where estado in ('pendiente','error');

-- Conversaciones del chat Claude embebido (contexto por usuario)
create table chat_conversaciones (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo     text,
  creado_en  timestamptz not null default now()
);

create table chat_mensajes (
  id              bigint generated always as identity primary key,
  conversacion_id uuid not null references chat_conversaciones(id) on delete cascade,
  rol             text not null check (rol in ('user','assistant')),
  contenido       text not null,
  en              timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9 · VISTAS DE APOYO
-- ------------------------------------------------------------

-- TODAS las vistas con security_invoker: aplican el RLS del usuario que
-- consulta (sin esto, en PG15 una vista corre con permisos del dueño y
-- se salta el RLS de las tablas base).

-- Entregas = OPs con fecha_entregada (regla: no es tabla aparte)
create view v_entregas with (security_invoker = true) as
  select op.id, op.numero, op.cliente_id, op.ciudad_id, op.fecha_entregada,
         op.requiere_instalacion,
         (select sum(oi.cantidad * oi.precio_unit) from op_items oi where oi.op_id = op.id) as valor
    from ordenes_pedido op
   where op.fecha_entregada is not null and op.activo;

-- Producto principal de una OP: el rack; si no hay, el de mayor precio
create view v_op_producto_principal with (security_invoker = true) as
  select distinct on (oi.op_id)
         oi.op_id, p.id as producto_id, p.nombre, p.es_rack,
         (select count(*) - 1 from op_items x where x.op_id = oi.op_id) as otros_items
    from op_items oi
    join productos p on p.id = oi.producto_id
   order by oi.op_id, p.es_rack desc, oi.precio_unit desc;

-- Saldo por OP: total facturable vs pagos recibidos (propios o de su
-- cotización). Logística consulta "¿debe saldo?" aquí antes de despachar.
create view v_op_saldo with (security_invoker = true) as
  select o.id as op_id, o.numero,
         coalesce((select sum(oi.cantidad * oi.precio_unit)
                     from op_items oi where oi.op_id = o.id), 0) as total,
         coalesce((select sum(p.monto) from pagos p
                    where p.op_id = o.id
                       or (o.cotizacion_id is not null
                           and p.cotizacion_id = o.cotizacion_id)), 0) as pagado
    from ordenes_pedido o
   where o.activo;

-- Consumo mensual por material (tendencias + buffers)
create view v_consumo_material_mensual with (security_invoker = true) as
  select e.material_id, date_trunc('month', m.en)::date as mes,
         sum(abs(m.cantidad)) as consumo
    from movimientos_inventario m
    join existencias e on e.id = m.existencia_id
   where m.tipo = 'salida_produccion' and e.material_id is not null
   group by e.material_id, date_trunc('month', m.en);

-- ------------------------------------------------------------
-- 10 · INTEGRIDAD DE NEGOCIO (la BD garantiza las reglas, no la app)
-- ------------------------------------------------------------

-- 10.1 · Kardex: aplicar movimiento al saldo + costo promedio ponderado.
-- SECURITY DEFINER: el saldo lo mantiene la BD; el usuario solo necesita
-- permiso de INSERT sobre movimientos_inventario.
-- FOR EACH STATEMENT + orden canónico por existencia_id: dos transacciones
-- concurrentes (webhooks, dos OPs entrando a Corte con materiales comunes)
-- adquieren los locks EN EL MISMO ORDEN → sin deadlocks entre multi-fila.
create or replace function fn_aplicar_movimiento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_saldo_previo numeric(12,3);
  v_material     uuid;
  v_costo_previo numeric(14,4);
begin
  for m in select * from nuevos order by existencia_id, id loop
    select e.cantidad_disponible, e.material_id
      into v_saldo_previo, v_material
      from existencias e
     where e.id = m.existencia_id
       for update;
    if not found then
      raise exception 'Existencia % no existe', m.existencia_id;
    end if;

    -- promedio ponderado: entradas con costo sobre materia prima.
    -- 'ajuste' con costo permite fijar el costo en cargas iniciales.
    -- Si el saldo previo no tiene costo (promedio 0), el costo entrante
    -- ES el nuevo promedio: un saldo fantasma a costo 0 no diluye compras.
    if v_material is not null and m.costo_unit is not null and m.cantidad > 0
       and m.tipo in ('entrada_compra','devolucion','ajuste') then
      select costo_promedio into v_costo_previo
        from materiales where id = v_material for update;
      update materiales
         set costo_promedio = case
               when v_saldo_previo <= 0 or coalesce(v_costo_previo, 0) = 0
                 then m.costo_unit
               else round(
                 (v_saldo_previo * v_costo_previo + m.cantidad * m.costo_unit)
                 / (v_saldo_previo + m.cantidad), 4)
             end
       where id = v_material;
    end if;

    update existencias
       set cantidad_disponible = cantidad_disponible + m.cantidad
     where id = m.existencia_id;
    -- si queda negativo, el CHECK de existencias aborta TODA la transacción
  end loop;
  return null;
end $$;

create trigger trg_aplicar_movimiento after insert on movimientos_inventario
  referencing new table as nuevos
  for each statement execute function fn_aplicar_movimiento();

-- 10.2 · Kardex y despachos inmutables (correcciones = ajuste/despacho nuevo)
create or replace function fn_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % es inmutable: registre un ajuste o un evento nuevo', tg_table_name;
end $$;

create trigger trg_movinv_inmutable before update or delete on movimientos_inventario
  for each row execute function fn_inmutable();
create trigger trg_despachos_inmutable before update on op_despachos
  for each row execute function fn_inmutable();

-- 10.3 · Despachos → cantidad_entregada derivada (nunca editada a mano).
-- INSERT suma, DELETE (solo Admin, política despachos_del) reversa. Los CHECK
-- de op_items (0 <= entregada <= cantidad) acotan ambos sentidos.
-- Orden canónico de locks: PRIMERO la OP, LUEGO el ítem (igual que 10.4).
-- El GUC transaccional 'bravefit.despacho' autoriza al trigger de 10.3b
-- a modificar cantidad_entregada; nadie más puede tocarla.
create or replace function fn_aplicar_despacho() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_op ordenes_pedido%rowtype;
begin
  select o.* into v_op
    from ordenes_pedido o
    join op_items oi on oi.op_id = o.id
   where oi.id = coalesce(new.op_item_id, old.op_item_id)
     for update of o;

  if tg_op = 'INSERT' then
    if v_op.id is not null and (not v_op.activo or v_op.eliminado_en is not null) then
      raise exception 'La OP % está anulada: no admite despachos', v_op.numero;
    end if;
    perform set_config('bravefit.despacho', '1', true);
    update op_items set cantidad_entregada = cantidad_entregada + new.cantidad
     where id = new.op_item_id;
    perform set_config('bravefit.despacho', '', true);
    return new;
  else
    if v_op.fecha_entregada is not null then
      raise exception 'La OP % ya está entregada: la reversa del despacho no está permitida', v_op.numero;
    end if;
    perform set_config('bravefit.despacho', '1', true);
    update op_items set cantidad_entregada = cantidad_entregada - old.cantidad
     where id = old.op_item_id;
    perform set_config('bravefit.despacho', '', true);
    return old;
  end if;
end $$;

create trigger trg_aplicar_despacho after insert or delete on op_despachos
  for each row execute function fn_aplicar_despacho();

-- 10.3b · cantidad_entregada SOLO cambia vía despachos (candado GUC):
-- ni PostgREST directo ni service_role pueden editarla a mano.
create or replace function fn_proteger_entregada() returns trigger
language plpgsql as $$
begin
  if new.cantidad_entregada is distinct from old.cantidad_entregada
     and coalesce(current_setting('bravefit.despacho', true), '') <> '1' then
    raise exception 'cantidad_entregada es derivada: registre el despacho en op_despachos';
  end if;
  return new;
end $$;

create trigger trg_opitems_entregada before update on op_items
  for each row execute function fn_proteger_entregada();

-- 10.4 · Una OP solo se marca Entregada/terminal con el 100% despachado.
-- Cubre INSERT y UPDATE (una OP no puede NACER entregada), incluye etapas
-- terminales (Instalado no se salta la validación), limpia fecha_entregada
-- si la OP retrocede a producción, y protege mp_descontada_en.
create or replace function fn_validar_entrega_op() returns trigger
language plpgsql as $$
declare
  v_etapa etapas_produccion%rowtype;
  v_primer_entrega smallint;
  v_total  numeric(14,2);
  v_pagado numeric(14,2);
begin
  select * into v_etapa from etapas_produccion where id = new.etapa_id;

  if tg_op = 'INSERT' then
    if v_etapa.es_entrega or v_etapa.es_terminal or new.fecha_entregada is not null then
      raise exception 'Una OP no puede crearse ya entregada o terminal: debe recorrer el flujo';
    end if;
    if new.mp_descontada_en is not null then
      raise exception 'mp_descontada_en solo la estampa fn_descontar_bom';
    end if;
    return new;
  end if;

  -- la marca de descuento de BOM es de una sola escritura y solo vía función
  if old.mp_descontada_en is not null
     and new.mp_descontada_en is distinct from old.mp_descontada_en then
    raise exception 'mp_descontada_en no se modifica ni se limpia una vez estampada';
  end if;
  if old.mp_descontada_en is null and new.mp_descontada_en is not null
     and coalesce(current_setting('bravefit.bom', true), '') <> '1' then
    raise exception 'mp_descontada_en solo la estampa fn_descontar_bom';
  end if;

  -- si retrocede a una etapa ANTERIOR a la entrega, deja de estar entregada
  -- (Pendiente instalación/Instalado van DESPUÉS de Entregado y la conservan)
  select min(orden) into v_primer_entrega from etapas_produccion where es_entrega;
  if new.etapa_id is distinct from old.etapa_id
     and not v_etapa.es_entrega and not v_etapa.es_terminal
     and v_etapa.orden < coalesce(v_primer_entrega, 32767) then
    new.fecha_entregada := null;
  end if;

  if (v_etapa.es_entrega or v_etapa.es_terminal) and new.fecha_entregada is null then
    new.fecha_entregada := current_date;
  end if;

  if (new.fecha_entregada is not null and old.fecha_entregada is null)
     or ((v_etapa.es_entrega or v_etapa.es_terminal)
         and new.etapa_id is distinct from old.etapa_id) then
    -- lock de los ítems: serializa contra reversas de despacho concurrentes
    perform 1 from op_items oi where oi.op_id = new.id for update;
    if not exists (select 1 from op_items oi where oi.op_id = new.id)
       or exists (select 1 from op_items oi
                   where oi.op_id = new.id and oi.cantidad_entregada < oi.cantidad) then
      raise exception 'La OP % no puede marcarse entregada: tiene ítems sin despachar al 100%%', new.numero;
    end if;

    -- REGLA DE JUAN (2026-07-04): con saldo pendiente NO hay entrega. Si el
    -- cliente ya pagó, se registra el pago primero — eso también es la realidad.
    select coalesce(sum(oi.cantidad * oi.precio_unit), 0) into v_total
      from op_items oi where oi.op_id = new.id;
    select coalesce(sum(p.monto), 0) into v_pagado
      from pagos p
     where p.op_id = new.id
        or (new.cotizacion_id is not null and p.cotizacion_id = new.cotizacion_id);
    if v_pagado < v_total then
      raise exception 'La OP % tiene saldo pendiente (pagado $% de $%): registre el pago antes de marcarla entregada',
        new.numero, v_pagado, v_total;
    end if;
  end if;
  return new;
end $$;

create trigger trg_op_entrega before insert or update on ordenes_pedido
  for each row execute function fn_validar_entrega_op();

-- 10.4b · Descuento de BOM atómico e idempotente: ÚNICA vía para estampar
-- mp_descontada_en. El UPDATE condicional reclama la marca (a prueba de dos
-- usuarios moviendo la OP a Corte a la vez); si ya estaba, retorna false y
-- NO descuenta de nuevo. El INSERT agrupa por existencia en orden canónico.
create or replace function fn_descontar_bom(p_op_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_claimed   uuid;
  v_faltantes text;
begin
  if auth.uid() is not null and not fn_puede('produccion','editar') then
    raise exception 'Sin permiso para descontar materia prima';
  end if;

  perform set_config('bravefit.bom', '1', true);
  update ordenes_pedido set mp_descontada_en = now()
   where id = p_op_id and mp_descontada_en is null
   returning id into v_claimed;
  perform set_config('bravefit.bom', '', true);
  if v_claimed is null then
    return false;  -- ya descontada: idempotente
  end if;

  select string_agg(distinct m.nombre, ', ') into v_faltantes
    from op_items oi
    join producto_componentes pc on pc.producto_id = oi.producto_id
                                and pc.material_id is not null
    join materiales m on m.id = pc.material_id
    left join existencias e on e.material_id = pc.material_id
   where oi.op_id = p_op_id and e.id is null;
  if v_faltantes is not null then
    raise exception 'Materiales del BOM sin existencia registrada: %', v_faltantes;
  end if;

  insert into movimientos_inventario (existencia_id, tipo, cantidad, op_id, usuario_id, nota)
  select e.id, 'salida_produccion', -sum(pc.cantidad * oi.cantidad), p_op_id, auth.uid(),
         'Descuento BOM automático (entrada a Corte)'
    from op_items oi
    join producto_componentes pc on pc.producto_id = oi.producto_id
                                and pc.material_id is not null
    join existencias e on e.material_id = pc.material_id
   where oi.op_id = p_op_id
   group by e.id
   order by e.id;
  return true;
end $$;

-- 10.5 · CRM: no se puede Ganar (→ OP automática) sin cotización con ítems,
-- y 'días en etapa' se marca solo al mover la ficha.
create or replace function fn_validar_ganada() returns trigger
language plpgsql as $$
begin
  if new.etapa_id is distinct from old.etapa_id
     and exists (select 1 from etapas_crm e where e.id = new.etapa_id and e.es_ganada) then
    if new.cotizacion_id is null
       or not exists (select 1 from cotizacion_items ci
                       where ci.cotizacion_id = new.cotizacion_id) then
      raise exception 'No se puede ganar la oportunidad sin una cotización con ítems';
    end if;
  end if;
  return new;
end $$;

create trigger trg_oportunidad_ganada before update on oportunidades
  for each row execute function fn_validar_ganada();

create or replace function fn_marcar_movida() returns trigger
language plpgsql as $$
begin
  new.movida_en := now();
  return new;
end $$;

create trigger trg_oportunidad_movida before update on oportunidades
  for each row when (old.etapa_id is distinct from new.etapa_id)
  execute function fn_marcar_movida();

-- 10.6 · Recepciones: la suma recibida por ítem de SC no supera lo pedido.
-- FOR UPDATE sobre sc_items serializa recepciones concurrentes del mismo ítem.
-- SECURITY DEFINER: con RLS del invocador, SELECT FOR UPDATE filtraría en
-- silencio filas que el rol no puede editar (v_pedida NULL → sin validación).
create or replace function fn_validar_recepcion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pedida numeric(12,3); v_previa numeric(12,3);
begin
  select cantidad into v_pedida from sc_items where id = new.sc_item_id for update;
  if v_pedida is null then
    raise exception 'Ítem de solicitud de compra % no existe', new.sc_item_id;
  end if;
  select coalesce(sum(cant_recibida), 0) into v_previa
    from recepcion_items
   where sc_item_id = new.sc_item_id and id <> new.id;
  if v_previa + new.cant_recibida > v_pedida then
    raise exception 'Recepción supera lo solicitado: % recibido de % pedido',
      v_previa + new.cant_recibida, v_pedida;
  end if;
  return new;
end $$;

create trigger trg_validar_recepcion before insert or update on recepcion_items
  for each row execute function fn_validar_recepcion();

-- ------------------------------------------------------------
-- 11 · TRIGGER GENÉRICO DE AUDITORÍA
-- ------------------------------------------------------------

create or replace function fn_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cambios jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value))
      into v_cambios
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
     where o.value is distinct from n.value;
    if v_cambios is null then return new; end if;
  elsif tg_op = 'DELETE' then
    v_cambios := to_jsonb(old);
  else
    v_cambios := to_jsonb(new);
  end if;
  insert into auditoria (usuario_id, tabla, registro_id, accion, cambios)
  values (auth.uid(), tg_table_name,
          coalesce((to_jsonb(coalesce(new, old))->>'id'), '?'),
          lower(tg_op), v_cambios);
  return coalesce(new, old);
end $$;

-- Auditar las tablas de negocio sensibles
do $$
declare t text;
begin
  foreach t in array array[
    'cotizaciones','cotizacion_items','ordenes_pedido','op_items','oportunidades',
    'productos','materiales','existencias','solicitudes_compra','sc_items',
    'recepciones','recepcion_items','garantias','clientes','proveedores',
    'empleados','empleados_confidencial','vacaciones','evaluaciones','pyg_mensual',
    'usuarios','permisos','facturas','pagos'
  ] loop
    execute format('create trigger trg_aud_%I after insert or update or delete on %I
                    for each row execute function fn_auditar()', t, t);
  end loop;
end $$;
