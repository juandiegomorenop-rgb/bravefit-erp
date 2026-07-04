-- ============================================================
-- ERP BRAVEFIT · Seed · Catálogos parametrizables y configuración
-- Todo lo aquí sembrado es EDITABLE desde el módulo Configuración.
-- ============================================================

-- ---------- Roles ----------
insert into roles (nombre, descripcion) values
  ('Administrador', 'Acceso total a todos los módulos'),
  ('Operaciones 1', 'Producción y Logística · vacaciones propias y de técnicos · evaluaciones de técnicos'),
  ('Operaciones 2', 'Producción y Logística · vacaciones propias · evaluaciones de técnicos');

-- ---------- Permisos ----------
-- Administrador: todo
insert into permisos (rol_id, modulo, puede_ver, puede_crear, puede_editar, puede_aprobar)
select r.id, m.modulo, true, true, true, true
  from roles r,
       (values ('ventas'),('produccion'),('mercadeo'),('rrhh'),('rrhh_nomina'),
               ('rrhh_vacaciones_tecnicos'),('rrhh_evaluaciones_tecnicos'),
               ('finanzas'),('cartelera'),('dashboard'),('configuracion'),
               ('nucleo'),('chat')) as m(modulo)
 where r.nombre = 'Administrador';

-- Operaciones 1: producción total + técnicos (vacaciones y evaluaciones)
insert into permisos (rol_id, modulo, puede_ver, puede_crear, puede_editar, puede_aprobar, campos_ocultos)
select r.id, x.modulo, x.v, x.c, x.e, false, x.oc::jsonb
  from roles r,
       (values ('produccion',                 true,  true,  true,  '[]'),
               ('rrhh_vacaciones_tecnicos',   true,  false, false, '[]'),
               ('rrhh_evaluaciones_tecnicos', true,  false, false, '[]'),
               ('cartelera',                  true,  true,  false, '[]'),
               ('dashboard',                  true,  false, false, '[]'),
               ('chat',                       true,  false, false, '[]')
       ) as x(modulo, v, c, e, oc)
 where r.nombre = 'Operaciones 1';

-- Operaciones 2: igual a Ops1 pero SIN vacaciones de técnicos
insert into permisos (rol_id, modulo, puede_ver, puede_crear, puede_editar, puede_aprobar, campos_ocultos)
select r.id, x.modulo, x.v, x.c, x.e, false, x.oc::jsonb
  from roles r,
       (values ('produccion',                 true,  true,  true,  '[]'),
               ('rrhh_evaluaciones_tecnicos', true,  false, false, '[]'),
               ('cartelera',                  true,  true,  false, '[]'),
               ('dashboard',                  true,  false, false, '[]'),
               ('chat',                       true,  false, false, '[]')
       ) as x(modulo, v, c, e, oc)
 where r.nombre = 'Operaciones 2';

-- ---------- Numeraciones ----------
-- OJO: 'cotizacion' debe continuar la serie BFP del Planner.
-- Ajustar `siguiente` al último consecutivo real antes de salir a producción.
insert into secuencias (clave, prefijo, relleno, siguiente) values
  ('cotizacion', 'BFP-', 4, 100),   -- AJUSTAR al último BFP-#### del Planner
  ('op',         'OP-',  3, 1),
  ('garantia',   'GR-',  4, 1),
  ('sc',         'SC-',  3, 1);

-- ---------- Etapas de producción (flujo OP y Garantías) ----------
insert into etapas_produccion (nombre, orden, es_entrega, es_terminal, descuenta_mp) values
  ('En Cola',                 1,  false, false, false),
  ('Corte',                   2,  false, false, true ),  -- aquí se descuenta materia prima (BOM)
  ('Soldadura',               3,  false, false, false),
  ('Perforación',             4,  false, false, false),
  ('Pintura',                 5,  false, false, false),
  ('Ensamble',                6,  false, false, false),
  ('Empaque',                 7,  false, false, false),
  ('Esperando Transportadora',8,  false, false, false),
  ('En Reparto',              9,  false, false, false),
  ('Entregado',               10, true,  true,  false),  -- terminal si no requiere instalación
  ('Pendiente instalación',   11, false, false, false),
  ('Instalado',               12, false, true,  false);

-- ---------- Etapas CRM ----------
insert into etapas_crm (nombre, orden, color, es_ganada, es_perdida) values
  ('En conversaciones',                1, '#5a5a5a', false, false),
  ('Elaborando Cotización y/o Render', 2, '#a06d10', false, false),
  ('Cotizado',                         3, '#3b5bb5', false, false),
  ('Ganado',                           4, '#1a7f4e', true,  false),  -- dispara OP automática
  ('Perdido',                          5, '#c2410c', false, true );

-- ---------- Estados de cotización ----------
insert into estados_cotizacion (nombre, orden) values
  ('Borrador', 1), ('Enviada', 2), ('Aprobada', 3), ('Vencida', 4), ('Anulada', 5);

-- ---------- Orígenes de OP ----------
insert into origenes_op (clave, nombre) values
  ('shopify',    'Shopify'),
  ('whatsapp',   'WhatsApp'),
  ('planner',    'Planner'),
  ('cotizacion', 'Cotización');

-- ---------- Tipos de material ----------
insert into tipos_material (nombre) values
  ('Tubería'), ('Platinería'), ('Cojinería'), ('Tornillería'),
  ('Plásticos de ingeniería'), ('Insumos'), ('Pintura'), ('Otros');

-- ---------- Unidades ----------
insert into unidades_medida (clave, nombre) values
  ('und', 'Unidad'), ('m', 'Metro'), ('kg', 'Kilogramo'), ('gl', 'Galón');

-- ---------- Colores estándar (paleta del planner) ----------
insert into colores (nombre, hex) values
  ('Negro', '#0E0E0E'), ('Rojo', '#D43A2F'), ('Azul', '#3B82F6'),
  ('Blanco', '#FFFFFF'), ('Gris', '#6B6B6B'), ('Verde militar', '#4B5320');

-- ---------- Categorías de producto (1:1 Shopify) ----------
insert into categorias_producto (clave, nombre, orden) values
  ('racks', 'Racks', 1), ('rigs', 'Rigs', 2), ('accesorios', 'Accesorios', 3),
  ('outdoor', 'Outdoor', 4), ('hogar', 'Hogar', 5), ('fuerza', 'Fuerza', 6),
  ('acondicionamiento', 'Acondicionamiento', 7), ('almacenamiento', 'Almacenamiento', 8);

-- ---------- Recargos premium (personalización ATO/MTO) ----------
insert into recargos (nombre, tipo, valor, aplica_a) values
  ('Color no estándar (ATO)', 'pct', 8,  'item'),
  ('Fabricación a medida (MTO)', 'pct', 15, 'item'),
  ('Instalación', 'fijo', 0, 'total');   -- valor se define por cotización

-- ---------- Conceptos PyG (parametrizables; metas las define gerencia) ----------
insert into conceptos_pyg (nombre, orden, meta_pct, mejor_direccion) values
  ('Ventas',                 1, null,  'mayor'),
  ('Costo de ventas',        2, null,  'menor'),
  ('Utilidad bruta',         3, null,  'mayor'),
  ('Gastos de administración',4, null, 'menor'),
  ('Gastos de ventas',       5, null,  'menor'),
  ('Utilidad operativa',     6, null,  'mayor'),
  ('Otros ingresos y egresos',7, null,  'mayor'),
  ('Utilidad neta',          8, null,  'mayor');

-- ---------- Ciudades principales ----------
insert into ciudades (nombre, departamento) values
  ('Medellín', 'Antioquia'), ('Bogotá', 'Cundinamarca'), ('Cali', 'Valle del Cauca'),
  ('Barranquilla', 'Atlántico'), ('Cartagena', 'Bolívar'), ('Bucaramanga', 'Santander'),
  ('Pereira', 'Risaralda'), ('Manizales', 'Caldas'), ('Armenia', 'Quindío'),
  ('Cúcuta', 'Norte de Santander'), ('Ibagué', 'Tolima'), ('Santa Marta', 'Magdalena'),
  ('Villavicencio', 'Meta'), ('Pasto', 'Nariño'), ('Montería', 'Córdoba'),
  ('Rionegro', 'Antioquia'), ('Envigado', 'Antioquia'), ('Itagüí', 'Antioquia');

-- ---------- Festivos Colombia 2026–2027 (Ley Emiliani aplicada) ----------
-- VERIFICAR contra calendario oficial antes de producción.
insert into festivos (fecha, nombre) values
  ('2026-01-01','Año Nuevo'), ('2026-01-12','Reyes Magos (trasladado)'),
  ('2026-03-23','San José (trasladado)'), ('2026-04-02','Jueves Santo'),
  ('2026-04-03','Viernes Santo'), ('2026-05-01','Día del Trabajo'),
  ('2026-05-18','Ascensión (trasladado)'), ('2026-06-08','Corpus Christi (trasladado)'),
  ('2026-06-15','Sagrado Corazón (trasladado)'), ('2026-06-29','San Pedro y San Pablo'),
  ('2026-07-20','Independencia'), ('2026-08-07','Batalla de Boyacá'),
  ('2026-08-17','Asunción (trasladado)'), ('2026-10-12','Día de la Raza'),
  ('2026-11-02','Todos los Santos (trasladado)'), ('2026-11-16','Independencia de Cartagena (trasladado)'),
  ('2026-12-08','Inmaculada Concepción'), ('2026-12-25','Navidad'),
  ('2027-01-01','Año Nuevo'), ('2027-01-11','Reyes Magos (trasladado)'),
  ('2027-03-22','San José (trasladado)'), ('2027-03-25','Jueves Santo'),
  ('2027-03-26','Viernes Santo'), ('2027-05-01','Día del Trabajo'),
  ('2027-05-10','Ascensión (trasladado)'), ('2027-05-31','Corpus Christi (trasladado)'),
  ('2027-06-07','Sagrado Corazón (trasladado)'), ('2027-07-05','San Pedro y San Pablo (trasladado)'),
  ('2027-07-20','Independencia'), ('2027-08-07','Batalla de Boyacá'),
  ('2027-08-16','Asunción (trasladado)'), ('2027-10-18','Día de la Raza (trasladado)'),
  ('2027-11-01','Todos los Santos'), ('2027-11-15','Independencia de Cartagena (trasladado)'),
  ('2027-12-08','Inmaculada Concepción'), ('2027-12-25','Navidad');
