-- ============================================================
-- BOM BANCO RECLINABLE (6BaPle) — regla dictada por Juan 23-jul-2026
-- ============================================================
-- REGLA: "un banco reclinable consume 1 platina de cada tipo
--         y 2 basculantes".
--
-- El BOM cargado el 17-jul tenía DOS errores:
--   P036 basculante            decía 1  → son 2
--   P041 en C posiciones asiento  decía 2  → es 1
--   P042 en C posiciones espaldar decía 2  → es 1
--
-- Esto explica dos cosas que no cuadraban:
--  · Los 3 bancos parados esperando basculante: entraron 8 P036 en
--    julio, que a 2 por banco solo alcanzan para 4 bancos.
--  · La anomalía de los conteos del 17 y 21 de julio, donde P041/P042
--    se movían al doble de ritmo que el resto de las platinas del
--    banco. No era un error de conteo: el BOM las pedía de a 2.
--
-- Se escribe como REGLA, no como lista de números: todas las líneas
-- del banco quedan en 1, y la basculante en 2. Así no hay que tocar
-- nada si mañana se agrega otra platina al despiece.
--
-- No reescribe historia: fn_descontar_bom es de una sola pasada, las
-- OPs ya descontadas no se recalculan.
-- Idempotente: se puede correr varias veces.
-- ============================================================

-- 1 · Todas las platinas del banco: 1 por banco.
update producto_componentes pc
   set cantidad = 1
  from productos p, materiales m
 where pc.producto_id = p.id
   and pc.material_id = m.id
   and p.sku = '6BaPle'
   and m.nombre ~ '^P0'
   and m.nombre not like 'P036 ·%'
   and pc.cantidad <> 1;

-- 2 · Excepción: la basculante son 2.
update producto_componentes pc
   set cantidad = 2
  from productos p, materiales m
 where pc.producto_id = p.id
   and pc.material_id = m.id
   and p.sku = '6BaPle'
   and m.nombre like 'P036 ·%'
   and pc.cantidad <> 2;

-- Verificación: la basculante en 2, todas las demás en 1.
select m.nombre, pc.cantidad
  from producto_componentes pc
  join productos  p on p.id = pc.producto_id
  join materiales m on m.id = pc.material_id
 where p.sku = '6BaPle'
 order by m.nombre;
