-- ============================================================
-- NUMERACIÓN DE OPs — corrección (hallazgo de Juan 20-jul-2026):
--   1) La sigla debe decir DE DÓNDE VINO EL PEDIDO. Al ganar una
--      cotización el código ponía "COT" (OP_COT_0016) en vez de
--      heredar el origen de la cotización (COT_BFP_0002 → BFP).
--      Ya corregido en la app; aquí se arregla la OP existente.
--   2) El consecutivo se calculaba contando OPs (dos altas
--      simultáneas → mismo número). Ahora la app usa la secuencia
--      `op`; hay que dejarla en el siguiente número libre.
-- Idempotente.
-- ============================================================

-- 1) Renombrar las OPs que quedaron con la sigla COT heredando el
--    origen real de su cotización (BFP/WA/SR/SPFY). Conserva el
--    consecutivo: OP_COT_0016 → OP_BFP_0016.
update ordenes_pedido o
   set numero = 'OP_' || case c.origen
                           when 'planner'  then 'BFP'
                           when 'whatsapp' then 'WA'
                           when 'showroom' then 'SR'
                           when 'shopify'  then 'SPFY'
                           when 'chat'     then 'CHAT'
                           else 'MAN'
                         end
                || '_' || substring(o.numero from '(\d+)$')
  from cotizaciones c
 where c.id = o.cotizacion_id
   and o.numero like 'OP\_COT\_%';

-- 2) Secuencia `op` = siguiente número libre (mayor consecutivo + 1).
update secuencias
   set siguiente = coalesce(
         (select max(substring(numero from '(\d+)$')::int) from ordenes_pedido),
         0) + 1
 where clave = 'op';

-- Verificación: las OPs con su origen y la secuencia lista
select o.numero, c.numero as cotizacion, c.origen as origen_lead
  from ordenes_pedido o
  left join cotizaciones c on c.id = o.cotizacion_id
 order by substring(o.numero from '(\d+)$')::int desc
 limit 20;

select clave, prefijo, siguiente from secuencias where clave = 'op';
