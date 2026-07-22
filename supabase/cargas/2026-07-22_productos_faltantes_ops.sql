-- ============================================================
-- PRODUCTOS FALTANTES PARA LA CARGA DE OPs — v2 (22-jul-2026)
-- ============================================================
-- v2: reescrito con la TAXONOMÍA DE SKU de Juan (el 1er dígito
-- indica la línea) y con sus decisiones sobre duplicados:
--   1 Racks · 2 Rigs · 3 Accesorios rack/rig · 4 Outdoor
--   5 Hogar · 6 Fuerza · 7 Acondicionamiento · 8 Almacenamiento
--
-- CAMBIOS vs v1:
--   · Cama de Pilates: era 'propio' → es COMERCIALIZADO (7).
--   · 7TrxP3Pro NO se crea: es el mismo 7SetTrxPro ya existente.
--   · Se ELIMINAN 8ColAccPa18 y 8AlmBalPa15 (eran basura de catálogo,
--     one-off de Aider) → pasan al patrón "fabricación especial".
--   · Nuevo patrón FABRICACIÓN ESPECIAL: un SKU genérico por línea
--     (3Especial, 8Especial) + descripción libre por ítem, para no
--     llenar el catálogo de piezas irrepetibles.
--
-- ⚠️ PRECIOS EN $0: Juan los completa desde Ventas → Productos.
-- ============================================================

-- ---- 1. Descripción libre por ítem de OP -------------------
-- cotizacion_items YA tenía `descripcion` (ítems no catalogados);
-- op_items no. Se agrega para que la "fabricación especial" muestre
-- el detalle real en la OP y en el formato imprimible.
alter table op_items
  add column if not exists descripcion text;

comment on column op_items.descripcion is
  'Detalle libre de la línea. Obligatorio en la práctica para los SKU de fabricación especial (3Especial/8Especial): describe QUÉ es la pieza. Si viene nulo, la UI muestra el nombre del producto.';

-- ---- 2. Limpieza: los 2 one-off que no deben ser catálogo --
-- Solo se borran si nadie los usó todavía (aún no hay OPs cargadas).
delete from productos p
 where p.sku in ('8ColAccPa18','8AlmBalPa15')
   and not exists (select 1 from op_items       oi where oi.producto_id = p.id)
   and not exists (select 1 from cotizacion_items ci where ci.producto_id = p.id);

-- ---- 3. Productos nuevos ------------------------------------
insert into productos (sku, nombre, categoria, unidad, tipo, requiere_bom, precio_lista, imagen_url)
values
  -- 3 · Accesorios de rack/rig
  ('3DualFlex','Dual Flex','accesorios','MTS','propio',false,0,null),
  ('3BrHam11','Brazos moviles tipo hammer para rack 1.1m','accesorios','MTS','propio',false,0,null),
  ('3Especial','Fabricacion especial - Accesorio de rack (ver detalle en la linea)','accesorios','MTS','propio',false,0,null),

  -- 6 · Fuerza
  ('6BaRom','Barra romana','fuerza','MTS','comercializado',false,0,null),
  ('6BaHex','Barra hexagonal','fuerza','MTS','comercializado',false,0,null),
  ('6BaRec12','Barra recta 1.2m','fuerza','MTS','comercializado',false,0,null),
  ('6PrensaEvo','Prensa de peso libre EVO Platinum','fuerza','MTS','comercializado',false,0,null),

  -- 7 · Acondicionamiento
  ('7PilCama','Cama de Pilates','acondicionamiento','MTS','comercializado',false,0,null),
  ('7TulaBox30','Tula de boxeo 30kg','acondicionamiento','MTS','comercializado',false,0,null),
  ('7Step2N','Step 2 niveles','acondicionamiento','MTS','comercializado',false,0,null),
  ('7Step3N','Step 3 niveles','acondicionamiento','MTS','comercializado',false,0,null),
  ('7KitBanPod','Kit de bandas de poder','acondicionamiento','MTS','comercializado',false,0,null),
  ('7KitBanTub','Kit de bandas tubulares (set de 3 resistencias)','acondicionamiento','MTS','comercializado',false,0,null),
  ('7KitBanRes','Kit de bandas de resistencia','acondicionamiento','MTS','comercializado',false,0,null),
  ('7FoamRol','Foam roller','acondicionamiento','MTS','comercializado',false,0,null),
  ('7LazoCross','Lazo crossfit','acondicionamiento','MTS','comercializado',false,0,null),
  ('7SpinRGo','Bici Spinning R-GO','acondicionamiento','MTS','comercializado',false,0,null),

  -- 8 · Almacenamiento y proteccion
  ('8ToAlMan8','Torre Almacenadora de Mancuernas 8 pares','almacenamiento','MTS','propio',false,0,null),
  ('8aldipa4','Almacenador de discos a pared 4N','almacenamiento','MTS','propio',false,0,null),
  ('8AlmFitb','Almacenador de fitball','almacenamiento','MTS','propio',false,0,null),
  ('8Especial','Fabricacion especial - Almacenamiento (ver detalle en la linea)','almacenamiento','MTS','propio',false,0,null)
on conflict (sku) do nothing;

-- Verificación 1: los 21 nuevos (deben salir todos).
select sku, nombre, categoria, tipo, precio_lista
  from productos
 where sku in ('3DualFlex','3BrHam11','3Especial','6BaRom','6BaHex','6BaRec12',
               '6PrensaEvo','7PilCama','7TulaBox30','7Step2N','7Step3N','7KitBanPod',
               '7KitBanTub','7KitBanRes','7FoamRol','7LazoCross','7SpinRGo',
               '8ToAlMan8','8aldipa4','8AlmFitb','8Especial')
 order by sku;

-- Verificación 2: los 2 borrados NO deben aparecer.
select sku from productos where sku in ('8ColAccPa18','8AlmBalPa15');

-- Verificación 3: op_items debe tener la columna descripcion.
select column_name, data_type from information_schema.columns
 where table_name = 'op_items' and column_name = 'descripcion';
