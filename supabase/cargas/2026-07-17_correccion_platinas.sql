-- ============================================================
-- CORRECCIÓN DE SALDOS DE PLATINAS — validación de Juan 17-jul-2026
-- ============================================================
-- Juan validó el listado completo y corrigió 7 referencias:
--   P056→0, P057→0, P059→0, P060→7, P061→4, P063→0, P064→12
-- El script lleva cada una a su valor correcto registrando un
-- 'ajuste' por la DIFERENCIA contra el saldo actual (traza en kardex).
-- Idempotente: si el saldo ya es el correcto, no registra nada.
-- ============================================================

do $$
declare
  v_user  uuid;
  v_ex    uuid;
  v_delta numeric;
  r record;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  for r in
    select * from (values
      ('P056 · Platina pie amigo pull up dc bar',  0),
      ('P057 · Platina pared dap bar',             0),
      ('P059 · Platina unión dap bar',             0),
      ('P060 · Platina pull up dap bar',           7),
      ('P061 · Platina doble tapa polea',          4),
      ('P063 · Platina almacenador 5 barras',      0),
      ('P064 · Almacenador de agarres',           12)
    ) as t(nombre, objetivo)
  loop
    select e.id, r.objetivo - e.cantidad_disponible
      into strict v_ex, v_delta
      from existencias e
      join materiales m on m.id = e.material_id
     where m.nombre = r.nombre and e.tipo = 'materia_prima';

    if v_delta <> 0 then
      insert into movimientos_inventario
        (existencia_id, tipo, cantidad, usuario_id, nota)
      values
        (v_ex, 'ajuste', v_delta, v_user,
         'Corrección conteo 16-jul · validación de Juan 17-jul-2026');
    end if;
  end loop;
end $$;

-- Verificación: las 7 deben quedar en 0, 0, 0, 7, 4, 0 y 12.
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre like any (array['P056%','P057%','P059%','P060%','P061%','P063%','P064%'])
 order by m.nombre;
