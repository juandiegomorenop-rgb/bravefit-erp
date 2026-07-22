-- ============================================================
-- PRODUCTOS NUEVOS — descubiertos al transcribir las OPs (22-jul)
-- ============================================================
-- Se crean ANTES de la carga de OPs para que los op_items
-- puedan matchear por SKU. Idempotente (on conflict do nothing).
--
--   8CarAlmDis  Carro Almacenador de Discos       $480.000  (Ortiz Pico)
--   7SetTrxPro  Set TRX Pro                        $99.900  (The Host Group)
--   8ColAccPa18 Columna a pared almacenadora 1.8m  $0        (Aider Duque)
--   8AlmBalPa15 Almacenador de balones pared 1.5m  $0        (Aider Duque)
--
-- Los dos de Aider quedan en $0 a propósito (Juan no tenía el
-- valor); se ajustan luego desde Ventas → Productos.
-- ============================================================

insert into productos (sku, nombre, categoria, unidad, tipo, requiere_bom, precio_lista, imagen_url)
values
  ('8CarAlmDis','Carro Almacenador de Discos','almacenamiento','MTS','propio',false,480000,null),
  ('7SetTrxPro','Set TRX Pro','acondicionamiento','MTS','comercializado',false,99900,null),
  ('8ColAccPa18','Columna a pared almacenadora de accesorios 1.8m (especial bajo pedido)','almacenamiento','MTS','propio',false,0,null),
  ('8AlmBalPa15','Almacenador de balones a pared 1.5m (especial bajo pedido)','almacenamiento','MTS','propio',false,0,null)
on conflict (sku) do nothing;

-- Verificación: deben salir las 4 filas.
select sku, nombre, precio_lista, tipo
  from productos
 where sku in ('8CarAlmDis','7SetTrxPro','8ColAccPa18','8AlmBalPa15')
 order by sku;
