-- ============================================================
-- RECONTEO PLATINAS BANCO RECLINABLE — Juan, planta 23-jul-2026
-- ============================================================
-- Juan recontó en planta: P037 a P042 = 7 de cada una.
--
-- Confirma el conteo del 21-jul, del que sospechábamos que el "7"
-- repetido en todas las filas era una fila copiada en Excel. No lo era.
-- La inconsistencia que veíamos venía del BOM (P041/P042 pedidas de a 2),
-- no del conteo — ver 2026-07-23_bom_banco_basculante.sql.
--
-- P036 (basculante) NO va aquí: su entrada de 7 unidades del 23-jul se
-- registra en 2026-07-23_llegadas_y_conteo_poleas.sql.
--
-- Ajuste por DIFERENCIA: deja el saldo EN 7. Si ya está en 7 no inserta
-- ningún movimiento. Idempotente.
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
      ('P037', 7), ('P038', 7), ('P039', 7),
      ('P040', 7), ('P041', 7), ('P042', 7)
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
         'Reconteo físico en planta 23-jul-2026 (platinas banco reclinable)');
    end if;
  end loop;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — códigos sin existencia (no ajustados): %', v_falta;
  end if;
end $$;

-- Verificación: las 7 referencias del banco (P036 incluida, para ver
-- de un vistazo si la basculante es la que frena).
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre ~ '^P(036|037|038|039|040|041|042) ·'
 order by m.nombre;
