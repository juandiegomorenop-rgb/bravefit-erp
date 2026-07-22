-- ============================================================
-- GARANTÍAS SIN OP ORIGINAL — opción C aprobada por Juan (22-jul)
-- ============================================================
-- Problema: `garantias.op_id` era NOT NULL, así que toda garantía
-- tenía que colgar de una OP del ERP. Pero los clientes que
-- compraron ANTES del ERP (Lina María Restrepo, Jhon Fredy Arenas,
-- y todos los que vendrán) no tienen esa OP — y no queremos
-- inventar ventas históricas que ensucien el módulo de Ventas.
--
-- Solución: op_id pasa a OPCIONAL + un campo de texto libre para
-- dejar el rastro de la compra original (fecha, factura, lo que se
-- sepa). El resto del flujo de garantías no cambia.
-- ============================================================

alter table garantias alter column op_id drop not null;

alter table garantias
  add column if not exists compra_original text;

comment on column garantias.op_id is
  'OP de origen. NULL cuando la compra es anterior al ERP: en ese caso el rastro va en compra_original.';
comment on column garantias.compra_original is
  'Referencia libre a la compra original cuando no hay OP en el ERP (fecha aproximada, factura, notas del cliente).';

-- Integridad: si no hay OP, debe haber al menos una referencia escrita.
alter table garantias drop constraint if exists garantias_origen_chk;
alter table garantias add constraint garantias_origen_chk
  check (op_id is not null or nullif(btrim(coalesce(compra_original,'')),'') is not null);

-- Verificación: op_id debe quedar en nullable = YES y existir compra_original.
select column_name, is_nullable, data_type
  from information_schema.columns
 where table_name = 'garantias' and column_name in ('op_id','compra_original')
 order by column_name;
