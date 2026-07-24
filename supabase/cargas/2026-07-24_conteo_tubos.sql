-- ============================================================
-- CONTEO FÍSICO DE TUBOS — Juan, planta 24-jul-2026
-- ============================================================
-- Primer conteo de tubería desde que se creó como material. Desbloquea
-- la fabricación de subensambles: sin metros de tubo, fn_fabricar_
-- subensamble rechaza (el CHECK >= 0), como se comprobó el 23-jul.
--
-- TUB70 · Tubo 70×70 = 112.4 m
--   15×4.5 + 4×6 + 2×1.8 + 3×1.6 + 1×2.1 + 7×1.2 + 1×0.8 + 2×0.6
--   Se cuentan tramos enteros Y retales aprovechables: la receta
--   consume por metro, no importa de qué tramo salga.
--
-- TUBR33 · Tubería redonda Ø33 = 36 m  (6 tubos × 6m)
--
-- Ajuste por DIFERENCIA (deja el saldo EN el número). Como hoy están en
-- 0, el ajuste es el total. Idempotente: si ya están en el número, no
-- inserta nada.
-- ============================================================

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
      ('TUB70',  112.4),
      ('TUBR33',  36.0)
    ) as t(codigo, objetivo)
  loop
    select e.id, r.objetivo - e.cantidad_disponible
      into v_ex, v_delta
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
         'Conteo físico de tubos en planta 24-jul-2026');
    end if;
  end loop;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — códigos sin existencia (no ajustados): %', v_falta;
  end if;
end $$;

-- Verificación: TUB70 = 112.4, TUBR33 = 36.
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre like 'TUB70 ·%' or m.nombre like 'TUBR33 ·%'
 order by m.nombre;
