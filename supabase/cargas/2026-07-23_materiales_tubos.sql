-- ============================================================
-- TUBERÍA COMO MATERIAL — decisión de Juan 23-jul-2026
-- ============================================================
-- Los dos tubos que exigen las recetas de subensambles. Se manejan
-- POR METRO, no por tubo de 6m: de un tubo de 6m casi no sobra nada
-- (2 columnas de 2.2m dejan 1.6m, de donde salen 3 uniones perforadas
-- de 0.5m → merma real ≈1.7%). El retal NO se modela como pieza
-- aparte; si hace falta, se refleja como % de merma en la receta.
--
--   TUB70   · Tubo PTS 70×70mm      → columnas, uniones perforadas, barra M
--   TUBR33  · Tubería redonda Ø33mm → barras (NO se perfora)
--
-- OJO VOCABULARIO: "tubo" es la materia prima que llega en longitud
-- de 6 metros; "barra" es la pieza del rack. Nunca decir "barra de 6m".
--
-- Solo crea los materiales (saldo en CERO). El stock entra por el
-- kardex: conteo físico (ajuste) o recepción de compra (entrada_compra).
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================

-- buffer_min/max quedan en CERO a propósito: son la señal de reposición
-- y los define Daniel/Juan cuando sepan el consumo por mes de metros.
insert into materiales (nombre, tipo_material_id, unidad_id, buffer_min, buffer_max)
select v.nombre, t.id, u.id, 0, 0
  from (values
    ('TUB70 · Tubo PTS 70×70mm',       'Tubería', 'm'),
    ('TUBR33 · Tubería redonda Ø33mm', 'Tubería', 'm')
  ) as v(nombre, tipo, unidad)
  join tipos_material  t on t.nombre = v.tipo
  join unidades_medida u on u.clave  = v.unidad
 where not exists (
   select 1 from materiales m where m.nombre = v.nombre
 );

-- Existencia en cero para que aparezcan ya en Inventarios (el saldo lo
-- mueve únicamente el kardex; la RLS solo admite crearlas en cero).
insert into existencias (material_id, tipo, cantidad_disponible, cantidad_reservada)
select m.id, 'materia_prima', 0, 0
  from materiales m
 where (m.nombre like 'TUB70 ·%' or m.nombre like 'TUBR33 ·%')
   and not exists (
     select 1 from existencias e
      where e.material_id = m.id and e.tipo = 'materia_prima'
   );

-- Verificación: deben salir las 2 filas, unidad 'm', disponible 0 y
-- buffers en 0 (pendiente definirlos).
select m.nombre, u.clave as unidad, t.nombre as tipo,
       coalesce(e.cantidad_disponible, 0) as disponible,
       m.buffer_min, m.buffer_max
  from materiales m
  join unidades_medida u on u.id = m.unidad_id
  join tipos_material  t on t.id = m.tipo_material_id
  left join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre like 'TUB70 ·%' or m.nombre like 'TUBR33 ·%'
 order by m.nombre;
