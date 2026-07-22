-- ============================================================
-- PRODUCTOS FALTANTES PARA LA CARGA DE OPs — 22-jul-2026
-- ============================================================
-- Al cruzar las 39 OPs contra el catálogo aparecieron estos ítems
-- que NO existen todavía. Deben crearse ANTES del SQL de carga,
-- porque los op_items se enganchan por SKU.
--
-- ⚠️ PRECIOS EN $0: Juan debe completarlos desde Ventas → Productos.
--    Se dejan en 0 a propósito en vez de inventar cifras. Las OPs
--    cargarán con precio 0 en esas líneas hasta que se ajusten.
--
-- Idempotente (on conflict do nothing).
-- ============================================================

insert into productos (sku, nombre, categoria, unidad, tipo, requiere_bom, precio_lista, imagen_url)
values
  -- ---- Almacenamiento -------------------------------------
  ('8ToAlMan8','Torre Almacenadora de Mancuernas 8 pares','almacenamiento','MTS','propio',false,0,null),
  ('8aldipa4','Almacenador de discos a pared 4N','almacenamiento','MTS','propio',false,0,null),
  ('8AlmFitb','Almacenador de fitball','almacenamiento','MTS','propio',false,0,null),
  ('8MueBand','Mueble de bandejas (a medida)','almacenamiento','MTS','propio',false,0,null),

  -- ---- Accesorios de rack ---------------------------------
  ('3DualFlex','Dual Flex','accesorios','MTS','propio',false,0,null),
  ('3BrHam11','Brazos moviles tipo hammer para rack 1.1m','accesorios','MTS','propio',false,0,null),
  ('3SopEscr','Soportes de escritorio a rack','accesorios','MTS','propio',false,0,null),

  -- ---- Fuerza ---------------------------------------------
  ('6BaRom','Barra romana','fuerza','MTS','comercializado',false,0,null),
  ('6BaHex','Barra hexagonal','fuerza','MTS','comercializado',false,0,null),
  ('6BaRec12','Barra recta 1.2m','fuerza','MTS','comercializado',false,0,null),
  ('6PrensaEvo','Prensa de peso libre EVO Platinum','fuerza','MTS','comercializado',false,0,null),

  -- ---- Acondicionamiento ----------------------------------
  ('7PilCamaBF','Cama de Pilates Bravefit','acondicionamiento','MTS','propio',false,0,null),
  ('7TrxP3Pro','TRX P3 PRO','acondicionamiento','MTS','comercializado',false,0,null),
  ('7TulaBox30','Tula de boxeo 30kg','acondicionamiento','MTS','comercializado',false,0,null),
  ('7Step2N','Step 2 niveles','acondicionamiento','MTS','comercializado',false,0,null),
  ('7Step3N','Step 3 niveles','acondicionamiento','MTS','comercializado',false,0,null),
  ('7KitBanPod','Kit de bandas de poder','acondicionamiento','MTS','comercializado',false,0,null),
  ('7KitBanTub','Kit de bandas tubulares','acondicionamiento','MTS','comercializado',false,0,null),
  ('7KitBanRes','Kit de bandas de resistencia','acondicionamiento','MTS','comercializado',false,0,null),
  ('7FoamRol','Foam roller','acondicionamiento','MTS','comercializado',false,0,null),
  ('7LazoCross','Lazo crossfit','acondicionamiento','MTS','comercializado',false,0,null),
  ('7SpinRGo','Bici Spinning R-GO','acondicionamiento','MTS','comercializado',false,0,null)
on conflict (sku) do nothing;

-- Verificación: las 22 nuevas + las 4 del script anterior.
select sku, nombre, tipo, precio_lista
  from productos
 where precio_lista = 0
   and sku in ('8ToAlMan8','8aldipa4','8AlmFitb','8MueBand','3DualFlex','3BrHam11',
               '3SopEscr','6BaRom','6BaHex','6BaRec12','6PrensaEvo','7PilCamaBF',
               '7TrxP3Pro','7TulaBox30','7Step2N','7Step3N','7KitBanPod','7KitBanTub',
               '7KitBanRes','7FoamRol','7LazoCross','7SpinRGo','8ColAccPa18','8AlmBalPa15')
 order by sku;
