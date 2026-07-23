-- ============================================================
-- LLEGADAS DEL 23-jul + CONTEO DE PLATINAS DE POLEA (Juan 23-jul)
-- ============================================================
-- DOS BLOQUES, a propósito distintos:
--
--  A) LLEGADAS DE HOY  → movimiento 'entrada_compra' (SUMA a lo que haya).
--     Es material que entró de verdad y sigue en el estante.
--     Sin factura a la mano: el costo entra al promedio vigente, que NO
--     mueve el promedio (mismo criterio que la recepción del ERP).
--
--  B) CONTEO DE POLEAS → 'ajuste' por DIFERENCIA (DEJA EN el número).
--     Juan contó el estante: 17 intermedias y 1 superior. Las 68 y 4 que
--     llegaron ya salieron empacadas a despachos, así que NO entran aquí:
--     el saldo del estante es lo contado. Quedan anotadas en la nota.
--
-- ⛔ NO incluye los bancos reclinables (4 en proceso + 3 esperando
--    basculante + 1 empacado): eso toca SE-EST-BANCOREC y P037-P042, que
--    siguen pendientes del reconteo. Va en script aparte.
--
-- Idempotente NO: el bloque A SUMA. Correr UNA sola vez.
-- ============================================================

do $$
declare
  v_user  uuid;
  v_ex    uuid;
  v_costo numeric;
  v_delta numeric;
  v_falta text := '';
  r record;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  -- ---- A) LLEGADAS DE HOY (suman) --------------------------
  for r in
    select * from (values
      ('P070',  6, 'Platina X para carro integrado'),
      ('P008', 20, 'Platina soporte seguridad sentadilla'),
      ('P036',  7, 'Platina centro basculación banco reclinable'),
      ('P019', 12, 'Platina fondo en rack'),
      ('P020',  6, 'Platina separador fondo a rack')
    ) as t(codigo, cantidad, nombre)
  loop
    select e.id, m.costo_promedio
      into v_ex, v_costo
      from existencias e
      join materiales m on m.id = e.material_id
     where m.nombre like r.codigo || ' ·%' and e.tipo = 'materia_prima';

    if not found then
      v_falta := v_falta || r.codigo || ' ';
      continue;
    end if;

    insert into movimientos_inventario
      (existencia_id, tipo, cantidad, costo_unit, usuario_id, nota)
    values
      (v_ex, 'entrada_compra', r.cantidad, coalesce(v_costo, 0), v_user,
       'Llegada de material 23-jul-2026 · costo estimado (promedio vigente, sin factura)');
  end loop;

  -- ---- B) CONTEO DEL ESTANTE (deja en el número) ------------
  for r in
    select * from (values
      ('P030', 17, 'llegaron 68 más el 23-jul pero salieron empacadas a despachos'),
      ('P029',  1, 'llegaron 4 más el 23-jul pero salieron empacadas a despachos')
    ) as t(codigo, objetivo, detalle)
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
        (v_ex, 'ajuste', v_delta,  v_user,
         'Conteo físico 23-jul-2026 · ' || r.detalle);
    end if;
  end loop;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — códigos sin existencia (no movidos): %', v_falta;
  end if;
end $$;

-- Verificación: saldos de las 7 referencias tocadas.
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre ~ '^P(070|008|036|019|020|030|029) ·'
 order by m.nombre;
