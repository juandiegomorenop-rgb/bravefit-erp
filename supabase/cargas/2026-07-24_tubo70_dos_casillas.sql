-- ============================================================
-- TUBO 70×70 EN DOS CASILLAS — decisión de Juan 24-jul-2026
-- ============================================================
-- El total de metros no dice si se puede cortar una columna: 112m en
-- retazos de 0.5m no dan ni una. Se parte el 70×70 en dos materiales:
--
--   TUB70L · tramo largo (≥2.2m)  → APTO PARA COLUMNA        91.5 m
--   TUB70R · retazo (<2.2m)       → solo uniones / cortos    20.9 m
--
-- Split del conteo del 24-jul:
--   Largo:   15×4.5 + 4×6                     = 91.5 m (19 tramos)
--   Retazo:  2×1.8+3×1.6+1×2.1+7×1.2+1×0.8+2×0.6 = 20.9 m
--   (el tramo de 2.1m es retazo: no alcanza para una columna de 2.2m)
--
-- Se REUSA el material TUB70 (creado el 23-jul) renombrándolo a TUB70L,
-- así no queda un material huérfano y la receta de la columna, que ya
-- apunta a él, no se toca. Solo la unión se repunta al bucket de retazos.
--
-- ⚠️ ESTE SCRIPT REEMPLAZA a 2026-07-24_conteo_tubos.sql para el 70×70.
-- Los saldos se fijan por DIFERENCIA a su objetivo, así que da igual si
-- ese script ya se corrió o no: TUB70L queda en 91.5 y TUB70R en 20.9.
-- El tubo redondo (TUBR33 = 36m) sigue en UNA casilla — hoy son 6 tubos
-- enteros de 6m, sin fragmentar. Si algún día se fragmenta, se parte igual.
--
-- LIMITACIÓN HONESTA que queda: dentro del bucket largo no se distingue
-- un tramo de 2.2m de uno de 4.5m, así que "metros largos ÷ 2.2" AÚN
-- sobreestima un poco las columnas (una columna sale de UN tramo, con su
-- merma). Pero ya no cuenta los retazos como si sirvieran, que era el
-- error grave. Para columnas de 2.3m/2.7m el umbral 2.2m se queda corto:
-- el que corta ve el tramo. El conteo mensual reconcilia.
--
-- Idempotente.
-- ============================================================

-- 1 · Renombrar TUB70 → TUB70L (si todavía se llama TUB70).
update materiales
   set nombre = 'TUB70L · Tubo 70×70 · tramo largo (≥2.2m)'
 where nombre like 'TUB70 ·%';

-- 2 · Crear el bucket de retazos (si no existe).
insert into materiales (nombre, tipo_material_id, unidad_id, buffer_min, buffer_max)
select 'TUB70R · Tubo 70×70 · retazo (<2.2m)', t.id, u.id, 0, 0
  from tipos_material t, unidades_medida u
 where t.nombre = 'Tubería' and u.clave = 'm'
   and not exists (select 1 from materiales m where m.nombre like 'TUB70R ·%');

-- 3 · Fijar saldos por diferencia (independiente de lo ya corrido).
do $$
declare
  v_user  uuid;
  v_ex    uuid;
  v_delta numeric;
  v_falta text := '';
  r record;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  for r in
    select * from (values
      ('TUB70L',  91.5),
      ('TUB70R',  20.9),
      ('TUBR33',  36.0)
    ) as t(codigo, objetivo)
  loop
    -- existencia (nace en cero si es la primera vez)
    insert into existencias (material_id, tipo, cantidad_disponible, cantidad_reservada)
    select m.id, 'materia_prima', 0, 0 from materiales m
     where m.nombre like r.codigo || ' ·%'
       and not exists (select 1 from existencias e
                        where e.material_id = m.id and e.tipo = 'materia_prima');

    select e.id, r.objetivo - e.cantidad_disponible into v_ex, v_delta
      from existencias e
      join materiales m on m.id = e.material_id
     where m.nombre like r.codigo || ' ·%' and e.tipo = 'materia_prima';

    if not found then
      v_falta := v_falta || r.codigo || ' ';
      continue;
    end if;

    if v_delta <> 0 then
      insert into movimientos_inventario
        (existencia_id, tipo, cantidad, usuario_id, nota)
      values
        (v_ex, 'ajuste', v_delta, v_user,
         'Conteo de tubos 24-jul-2026 · 70×70 en dos casillas (largo/retazo)');
    end if;
  end loop;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — códigos sin existencia (no ajustados): %', v_falta;
  end if;
end $$;

-- 4 · Repuntar la unión perforada a los RETAZOS (la columna se queda en
--     el largo). Regla para recetas futuras: columnas → TUB70L; uniones
--     perforadas y barra M (piezas cortas de 70×70) → TUB70R.
update producto_componentes pc
   set material_id = (select id from materiales where nombre like 'TUB70R ·%')
  from productos p
 where pc.producto_id = p.id
   and p.sku = 'SE-UNP-050'
   and pc.material_id = (select id from materiales where nombre like 'TUB70L ·%');

-- Verificación 1: las dos casillas + redondo.
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre like 'TUB70L ·%' or m.nombre like 'TUB70R ·%' or m.nombre like 'TUBR33 ·%'
 order by m.nombre;

-- Verificación 2: la receta de la unión 0.5m debe consumir del retazo.
select p.sku, m.nombre as componente, pc.cantidad
  from producto_componentes pc
  join productos  p on p.id = pc.producto_id
  join materiales m on m.id = pc.material_id
 where p.sku in ('SE-COL-220-NIV','SE-UNP-050')
   and (m.nombre like 'TUB70%')
 order by p.sku;
