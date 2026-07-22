-- ============================================================
-- SCRIPT 2 · PREPARACIÓN DE LA CARGA DE OPs — 22-jul-2026 (v2)
-- ============================================================
-- v2: FIX del error 42703 — la tabla productos usa categoria_id
-- (FK a categorias_producto por clave) + unidad_id (FK a
-- unidades_medida) + clasificacion/origen/es_rack, igual que la
-- carga del catálogo maestro del 17-jul. Reescrito con ese patrón.
--
-- Consolida: descripcion en op_items · garantías sin OP ·
-- renombre 6MaHex45kg→17.5kg · 27 productos nuevos.
-- Idempotente. Correr ANTES de la carga de OPs (script 4).
-- ============================================================

-- ===== 2.1 · Columna de descripción libre en ítems de OP =====
alter table op_items add column if not exists descripcion text;
comment on column op_items.descripcion is
  'Detalle libre de la linea. Se usa en los SKU de fabricacion especial (3Especial/8Especial). Si viene nulo, la UI muestra el nombre del producto.';

-- ===== 2.2 · Garantías sin OP original (clientes pre-ERP) =====
alter table garantias alter column op_id drop not null;
alter table garantias add column if not exists compra_original text;
alter table garantias drop constraint if exists garantias_origen_chk;
alter table garantias add constraint garantias_origen_chk
  check (op_id is not null or nullif(btrim(coalesce(compra_original,'')),'') is not null);

-- ===== 2.3 · Renombrar el SKU mal puesto de mancuernas =====
update productos set sku = '6MaHex17.5kg'
 where sku = '6MaHex45kg' and nombre ilike '%17.5%';

-- ===== 2.4 · Productos nuevos (patrón del catálogo maestro) =====
insert into productos (sku, nombre, categoria_id, clasificacion, origen, es_rack, unidad_id, precio_lista, imagen_url)
select v.sku, v.nombre, c.id, v.clasif, v.origen, v.es_rack,
       (select id from unidades_medida where clave='und'), v.precio, v.imagen
from (values
  ('8CarAlmDis','Carro Almacenador de Discos','almacenamiento','MTS','propio',false,480000,null),
  ('7SetTrxPro','Set TRX Pro','acondicionamiento','MTS','comercializado',false,99900,null),
  ('3DualFlex','Dual Flex','accesorios','MTS','propio',false,0,null),
  ('3BrHam11','Brazos moviles tipo hammer para rack 1.1m','accesorios','MTS','propio',false,0,null),
  ('3Especial','Fabricacion especial - Accesorio de rack (ver detalle en la linea)','accesorios','MTS','propio',false,0,null),
  ('6BaRom','Barra romana','fuerza','MTS','comercializado',false,0,null),
  ('6BaHex','Barra hexagonal','fuerza','MTS','comercializado',false,0,null),
  ('6BaRec12','Barra recta 1.2m','fuerza','MTS','comercializado',false,0,null),
  ('6PrensaEvo','Prensa de peso libre EVO Platinum','fuerza','MTS','comercializado',false,0,null),
  ('6MaHex22.5kg','Mancuernas Hexagonales encauchetadas 22.5kg','fuerza','MTS','comercializado',false,258750,null),
  ('6MaHex30kg','Mancuernas Hexagonales encauchetadas 30kg','fuerza','MTS','comercializado',false,345000,null),
  ('6MaHex35kg','Mancuernas Hexagonales encauchetadas 35kg','fuerza','MTS','comercializado',false,402500,null),
  ('6MaHex40kg','Mancuernas Hexagonales encauchetadas 40kg','fuerza','MTS','comercializado',false,460000,null),
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
  ('8ToAlMan8','Torre Almacenadora de Mancuernas 8 pares','almacenamiento','MTS','propio',false,0,null),
  ('8aldipa4','Almacenador de discos a pared 4N','almacenamiento','MTS','propio',false,0,null),
  ('8AlmFitb','Almacenador de fitball','almacenamiento','MTS','propio',false,0,null),
  ('8Especial','Fabricacion especial - Almacenamiento (ver detalle en la linea)','almacenamiento','MTS','propio',false,0,null)
) as v(sku,nombre,cat,clasif,origen,es_rack,precio,imagen)
join categorias_producto c on c.clave = v.cat
on conflict (sku) do nothing;

-- Verificación 1: deben salir 27 filas.
select p.sku, p.nombre, cp.clave as categoria, p.origen, p.precio_lista
  from productos p
  join categorias_producto cp on cp.id = p.categoria_id
 where p.sku in ('8CarAlmDis','7SetTrxPro','3DualFlex','3BrHam11','3Especial','6BaRom',
   '6BaHex','6BaRec12','6PrensaEvo','6MaHex22.5kg','6MaHex30kg','6MaHex35kg','6MaHex40kg',
   '7PilCama','7TulaBox30','7Step2N','7Step3N','7KitBanPod','7KitBanTub','7KitBanRes',
   '7FoamRol','7LazoCross','7SpinRGo','8ToAlMan8','8aldipa4','8AlmFitb','8Especial')
 order by p.sku;

-- Verificación 2: la línea de mancuernas completa con $/kg (la 17.5 renombrada).
select sku, nombre, precio_lista
  from productos where sku like '6MaHex%'
 order by regexp_replace(sku,'^6MaHex([0-9.]+)kg$','\1')::numeric;
