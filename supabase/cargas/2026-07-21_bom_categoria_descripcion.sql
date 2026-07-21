-- ============================================================
-- CORRECCIÓN: en la carga del BOM de platinas (script del 17-jul)
-- las columnas quedaron CRUZADAS — la BD guardó
--   categoria   = 'Platina xbean'  (el nombre)
--   descripcion = 'platineria'     (la categoría)
-- Detectado el 20-jul al revisar la sugerencia de juego en Compras.
-- Este swap las endereza. Idempotente: tras corregir, ninguna fila
-- cumple la condición.
-- ============================================================

update producto_componentes
   set categoria   = descripcion,
       descripcion = categoria
 where descripcion in ('platineria', 'impresion_3d');

-- Verificación: las categorías deben ser platineria/impresion_3d y
-- las descripciones los nombres de las platinas.
select categoria, count(*) as filas
  from producto_componentes
 where material_id is not null
 group by categoria
 order by filas desc;

select descripcion
  from producto_componentes
 where material_id is not null
 limit 5;
