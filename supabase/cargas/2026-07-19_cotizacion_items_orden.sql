-- ============================================================
-- ORDEN MANUAL DE ÍTEMS EN COTIZACIONES (drag & drop del editor)
-- Pedido de Juan 19-jul-2026: poder reordenar los ítems de una
-- cotización arrastrándolos; el número de ítem sigue ese orden.
-- Idempotente.
-- ============================================================

alter table cotizacion_items
  add column if not exists orden smallint not null default 0;

-- Backfill: las cotizaciones existentes quedan numeradas en su
-- orden físico actual (aproxima el orden de inserción). Solo toca
-- filas que siguen en 0 para no pisar reordenamientos posteriores.
with numeradas as (
  select id,
         row_number() over (partition by cotizacion_id order by ctid) - 1 as rn
  from cotizacion_items
)
update cotizacion_items ci
set orden = n.rn
from numeradas n
where ci.id = n.id
  and ci.orden = 0
  and n.rn > 0;

-- Verificación: los ítems de cada cotización deben salir 0,1,2,…
select c.numero, ci.orden, coalesce(p.nombre, ci.descripcion) as item
from cotizacion_items ci
join cotizaciones c on c.id = ci.cotizacion_id
left join productos p on p.id = ci.producto_id
order by c.numero, ci.orden
limit 30;
