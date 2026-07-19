-- ============================================================
-- NUMERACIÓN DE COTIZACIONES COT_<FUENTE>_#### (18-jul-2026)
-- Decisión de Juan: misma lógica que las OP — sigla por fuente del
-- lead (WA/SR/SPFY/BFP) + consecutivo GLOBAL que arranca en 1.
-- 1) Amplía las fuentes válidas de cotizaciones.
-- 2) La secuencia entrega solo el número (la app arma COT_XX_####).
-- 3) Policy DELETE de cotizacion_items (editar borradores) si falta.
-- 4) Origen 'showroom' también para las OPs (OP_SR_#### a futuro).
-- Idempotente. REEMPLAZA al script anterior de ajustes (ya no usar).
-- ============================================================

alter table cotizaciones drop constraint if exists cotizaciones_origen_check;
alter table cotizaciones add constraint cotizaciones_origen_check
  check (origen in ('manual','chat','planner','whatsapp','shopify','showroom'));

update secuencias set prefijo = '', siguiente = 1 where clave = 'cotizacion';

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename='cotizacion_items' and policyname='cotizacion_items_del') then
    create policy cotizacion_items_del on cotizacion_items
      for delete to authenticated using (fn_puede('ventas','editar'));
  end if;
end $$;

insert into origenes_op (clave, nombre)
select 'showroom', 'Showroom'
where not exists (select 1 from origenes_op where clave = 'showroom');

select clave, prefijo, siguiente from secuencias where clave = 'cotizacion';
