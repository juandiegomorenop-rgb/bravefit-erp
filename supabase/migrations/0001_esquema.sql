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

-- Entrega el siguiente número formateado de forma atómica (bloquea la fila)
create or replace function fn_siguiente_numero(p_clave text)
returns text language plpgsql as $$
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
create index idx_clientes_email on clientes (lower(email));
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
  origen        text not null default 'manual' check (origen in ('manual','chat','planner')),
  siigo_factura_id     text,                       -- id factura en Siigo
  siigo_factura_numero text,                       -- número fiscal devuelto por Siigo
  notas         text,
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  creado_en     timestamptz not null default now()
);
create index idx_cotizaciones_cliente on cotizaciones (cliente_id);
create index idx_cotizaciones_estado on cotizaciones (estado_id);
create index idx_cotizaciones_creado on cotizaciones (creado_en desc);

create table cotizacion_items (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  producto_id   uuid references productos(id),
  descripcion   text,                              -- libre para ítems no catalogados (ej. transporte)
  es_transporte boolean not null default false,
  aplica_iva    boolean not null default true,     -- transporte: elegible sin IVA
  cantidad      numeric(12,3) not null check (cantidad > 0),
  precio_unit   numeric(14,2) not null,            -- CON IVA si aplica_iva
  alto_override_cm  numeric(8,2),
  fondo_override_cm numeric(8,2),
  color         text,
  recargos      jsonb not null default '[]'::jsonb, -- [{recargo_id,nombre,tipo,valor,monto}]
  check (producto_id is not null or descripcion is not null)
);
create index idx_cotitems_cotizacion on cotizacion_items (cotizacion_id);

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
  origen_id     smallint not null references origenes_op(id),
  cotizacion_id uuid references cotizaciones(id),
  pedido_web_id uuid references pedidos_web(id),
  etapa_id      smallint not null references etapas_produccion(id),
  esperando_proveedor boolean not null default false, -- sub-estado en Cola (comercializados)
  requiere_instalacion boolean not null default false,
  direccion_entrega text,
  fecha_entrega_pactada date,
  fecha_entregada       date,                      -- solo cuando 100% despachado
  notas         text,
  activo        boolean not null default true,
  eliminado_en  timestamptz,
  creado_en     timestamptz not null default now()
  -- SEMÁFORO: calculado siempre desde fecha_entrega_pactada, NUNCA almacenado
);
create index idx_op_etapa on ordenes_pedido (etapa_id);
create index idx_op_entrega on ordenes_pedido (fecha_entrega_pactada);
create index idx_op_cliente on ordenes_pedido (cliente_id);

alter table pedidos_web
  add constraint fk_pedidos_web_op foreign key (op_id) references ordenes_pedido(id);

create table op_items (
  id           uuid primary key default gen_random_uuid(),
  op_id        uuid not null references ordenes_pedido(id) on delete cascade,
  producto_id  uuid not null references productos(id),
  cantidad     numeric(12,3) not null check (cantidad > 0),
  cantidad_entregada numeric(12,3) not null default 0 check (cantidad_entregada >= 0),
  precio_unit  numeric(14,2) not null,
  alto_override_cm  numeric(8,2),
  fondo_override_cm numeric(8,2),
  color        text,
  check (cantidad_entregada <= cantidad)           -- entregas parciales controladas
);
create index idx_opitems_op on op_items (op_id);

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

create table existencias (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id),
  material_id uuid references materiales(id),
  tipo        text not null check (tipo in ('terminado','materia_prima','en_proceso')),
  cantidad_disponible numeric(12,3) not null default 0,
  cantidad_reservada  numeric(12,3) not null default 0,
  check (num_nonnulls(producto_id, material_id) = 1),
  unique (producto_id, tipo),
  unique (material_id, tipo)
);

create table movimientos_inventario (
  id            bigint generated always as identity primary key,
  existencia_id uuid not null references existencias(id),
  tipo          text not null check (tipo in ('entrada_compra','salida_produccion','entrada_produccion','salida_venta','ajuste','devolucion','entrada_garantia','salida_garantia')),
  cantidad      numeric(12,3) not null,           -- signo según tipo (validado en app)
  costo_unit    numeric(14,4),                    -- para recalcular promedio ponderado
  op_id         uuid references ordenes_pedido(id),
  recepcion_id  uuid,                             -- FK diferida
  usuario_id    uuid references usuarios(id),
  nota          text,
  en            timestamptz not null default now()
);
create index idx_movinv_existencia on movimientos_inventario (existencia_id, en desc);

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

alter table movimientos_inventario
  add constraint fk_movinv_recepcion foreign key (recepcion_id) references recepciones(id);

create table recepcion_items (
  id             uuid primary key default gen_random_uuid(),
  recepcion_id   uuid not null references recepciones(id) on delete cascade,
  sc_item_id     uuid not null references sc_items(id),
  cant_recibida  numeric(12,3) not null default 0,
  cant_faltante  numeric(12,3) not null default 0,
  nota           text,
  faltante_resuelto boolean not null default false -- seguimiento hasta cierre
);

-- ---- Garantías (prioridad ambulancia) ----------------------

create table garantias (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,              -- GR-XXXX
  op_id         uuid not null references ordenes_pedido(id),
  producto_id   uuid references productos(id),
  cliente_id    uuid not null references clientes(id),
  vendedor_id   uuid references usuarios(id),      -- contacto ante dudas
  factura_numero    text,
  cotizacion_numero text,
  problema      text not null,
  detalle       text,
  recogida      text not null default 'por_definir'
                check (recogida in ('por_definir','bravefit_recoge','cliente_envia')),
  etapa_id      smallint not null references etapas_produccion(id), -- mismo flujo que OP
  costo_resolucion numeric(14,2),
  abierta_en    timestamptz not null default now(),
  cerrada_en    timestamptz,
  activo        boolean not null default true,
  eliminado_en  timestamptz
);
create index idx_garantias_abierta on garantias (abierta_en desc);

-- ------------------------------------------------------------
-- 6 · MERCADEO
-- ------------------------------------------------------------

create table campanas (
  id         uuid primary key default gen_random_uuid(),
  plataforma text not null check (plataforma in ('meta','google','tiktok','otro')),
  nombre     text not null,
  id_externo text,
  inicio     date,
  fin        date,
  activo     boolean not null default true,
  eliminado_en timestamptz
);

create table campana_metricas (
  id         bigint generated always as identity primary key,
  campana_id uuid not null references campanas(id) on delete cascade,
  fecha      date not null,
  inversion  numeric(14,2) not null default 0,
  alcance    integer not null default 0,
  clics      integer not null default 0,
  leads      integer not null default 0,
  unique (campana_id, fecha)
  -- CPL y ROAS se calculan en consulta, nunca se almacenan
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

create table redes_metricas (
  id            bigint generated always as identity primary key,
  plataforma    text not null,
  fecha         date not null,
  visualizaciones integer not null default 0,
  engagement    numeric(8,4) not null default 0,
  seguidores    integer,
  post_top_url  text,
  post_top_nota text,
  unique (plataforma, fecha)
);

-- ------------------------------------------------------------
-- 7 · RECURSOS HUMANOS Y CARTELERA
-- ------------------------------------------------------------

create table empleados (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  cedula        text not null unique,
  cargo         text,
  area          text,                              -- 'planta', 'administración'…
  es_tecnico    boolean not null default false,    -- clave para permisos Ops1/Ops2
  tipo_contrato text,
  salario_base  numeric(14,2),                     -- campo oculto según rol
  eps           text,
  arl           text,
  fecha_ingreso date,
  hoja_vida_url text,                              -- PDF en Storage
  activo        boolean not null default true,
  eliminado_en  timestamptz
);

alter table usuarios
  add constraint fk_usuarios_empleado foreign key (empleado_id) references empleados(id);

-- Nómina VIVE EN SIIGO por ahora. Tabla prevista para absorberla algún día.
create table nominas (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados(id),
  periodo     text not null,                       -- '2026-07'
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
  ciclo        text not null,                      -- '2026-1'
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

-- Cartelera: todos publican
create table publicaciones (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references usuarios(id),
  titulo     text,
  cuerpo     text not null,
  importante boolean not null default false,
  fijada     boolean not null default false,
  activo     boolean not null default true,
  eliminado_en timestamptz,
  creado_en  timestamptz not null default now()
);

create table publicacion_reacciones (
  publicacion_id uuid not null references publicaciones(id) on delete cascade,
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  tipo           text not null default 'like',
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
  periodo     text not null,                       -- '2026-04'
  concepto_id smallint not null references conceptos_pyg(id),
  valor       numeric(16,2) not null,
  cargado_por uuid references usuarios(id),
  en          timestamptz not null default now(),
  unique (periodo, concepto_id)
);

create table nivel_servicio_mensual (              -- pestaña Operación del dashboard
  periodo     text primary key,                    -- '2026-04'
  cumplidos   integer not null default 0,
  incumplidos integer not null default 0,
  observaciones text,
  cargado_por uuid references usuarios(id)
);

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
  procesado_en timestamptz,
  unique (sistema, tipo_evento, clave_externa)
);
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

-- Entregas = OPs con fecha_entregada (regla: no es tabla aparte)
create view v_entregas as
  select op.id, op.numero, op.cliente_id, op.ciudad_id, op.fecha_entregada,
         op.requiere_instalacion,
         (select sum(oi.cantidad * oi.precio_unit) from op_items oi where oi.op_id = op.id) as valor
    from ordenes_pedido op
   where op.fecha_entregada is not null and op.activo;

-- Producto principal de una OP: el rack; si no hay, el de mayor precio
create view v_op_producto_principal as
  select distinct on (oi.op_id)
         oi.op_id, p.id as producto_id, p.nombre, p.es_rack,
         (select count(*) - 1 from op_items x where x.op_id = oi.op_id) as otros_items
    from op_items oi
    join productos p on p.id = oi.producto_id
   order by oi.op_id, p.es_rack desc, oi.precio_unit desc;

-- Consumo mensual por material (tendencias + buffers)
create view v_consumo_material_mensual as
  select e.material_id, date_trunc('month', m.en)::date as mes,
         sum(abs(m.cantidad)) as consumo
    from movimientos_inventario m
    join existencias e on e.id = m.existencia_id
   where m.tipo = 'salida_produccion' and e.material_id is not null
   group by e.material_id, date_trunc('month', m.en);

-- ------------------------------------------------------------
-- 10 · TRIGGER GENÉRICO DE AUDITORÍA
-- ------------------------------------------------------------

create or replace function fn_auditar() returns trigger
language plpgsql security definer as $$
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
    'empleados','vacaciones','evaluaciones','pyg_mensual','usuarios','permisos'
  ] loop
    execute format('create trigger trg_aud_%I after insert or update or delete on %I
                    for each row execute function fn_auditar()', t, t);
  end loop;
end $$;
