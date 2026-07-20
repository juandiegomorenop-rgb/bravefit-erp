-- ============================================================
-- 1) Julián Montoya es la cuenta produccion@bravefit.co
--    (confirmado por Juan 19-jul-2026; "Jorge" era nombre del mock).
-- 2) BACKFILL EMBUDO: regla nueva "toda cotización queda en el
--    embudo" — las cotizaciones vivas que se crearon ANTES de la
--    regla reciben su oportunidad: Borrador → "Elaborando
--    Cotización y/o Render", Enviada → "Cotizado". Las Aprobadas/
--    Anuladas/viejas no se tocan (ya cerraron su ciclo).
-- Idempotente.
-- ============================================================

update usuarios
   set nombre = 'Julián Montoya'
 where email = 'produccion@bravefit.co';

insert into oportunidades (cliente_id, cotizacion_id, etapa_id, vendedor_id, notas)
select c.cliente_id,
       c.id,
       case when e.nombre = 'Borrador'
            then (select id from etapas_crm where nombre = 'Elaborando Cotización y/o Render')
            else (select id from etapas_crm where nombre = 'Cotizado') end,
       c.vendedor_id,
       'Vinculada al embudo (backfill regla 19-jul)'
  from cotizaciones c
  join estados_cotizacion e on e.id = c.estado_id
 where c.activo
   and e.nombre in ('Borrador', 'Enviada')
   and not exists (
     select 1 from oportunidades o
      where o.cotizacion_id = c.id and o.activo
   );

-- Verificación: cotizaciones vivas y su etapa en el embudo
select c.numero, e.nombre as estado, ec.nombre as etapa_embudo, u.nombre as vendedor
  from cotizaciones c
  join estados_cotizacion e on e.id = c.estado_id
  left join oportunidades o on o.cotizacion_id = c.id and o.activo
  left join etapas_crm ec on ec.id = o.etapa_id
  left join usuarios u on u.id = c.vendedor_id
 where c.activo
 order by c.creado_en desc
 limit 20;
