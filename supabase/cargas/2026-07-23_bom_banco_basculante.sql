-- ============================================================
-- BOM BANCO RECLINABLE: la platina basculante son 2, no 1
-- Corrección dictada por Juan el 23-jul-2026
-- ============================================================
-- El BOM cargado el 17-jul (2026-07-17_bom_platinas.sql:94) dice
-- P036 × 1. Juan confirmó que cada banco lleva DOS platinas
-- basculantes ("tienen todas las platinas excepto la platina
-- basculante (2 por banco)").
--
-- Esto además explica el atasco de hoy: entraron 8 P036 en julio,
-- que a 2 por banco alcanzan para 4 bancos — por eso hay 3 bancos
-- armados esperando basculante y por eso llegaron 7 más.
--
-- No reescribe historia: fn_descontar_bom es de una sola pasada,
-- las OPs ya descontadas no se recalculan.
-- Idempotente.
-- ============================================================

update producto_componentes pc
   set cantidad = 2
  from productos p, materiales m
 where pc.producto_id = p.id
   and pc.material_id = m.id
   and p.sku = '6BaPle'
   and m.nombre like 'P036 ·%'
   and pc.cantidad <> 2;

-- Verificación: la línea P036 del banco reclinable debe decir 2.
select p.sku, m.nombre, pc.cantidad
  from producto_componentes pc
  join productos  p on p.id = pc.producto_id
  join materiales m on m.id = pc.material_id
 where p.sku = '6BaPle'
 order by m.nombre;
