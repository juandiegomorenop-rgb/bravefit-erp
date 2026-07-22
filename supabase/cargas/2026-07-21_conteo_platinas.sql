-- ============================================================
-- CONTEO FÍSICO DE PLATINAS — 21-jul-2026 · v4 (match por CÓDIGO)
-- ============================================================
-- v4 (22-jul): FIX del error P0002 "query returned no rows". Las
-- refs P027/P028/P061 fueron RENOMBRADAS el 17-jul, así que el
-- match por nombre completo fallaba en el INTO STRICT. Ahora se
-- empareja por el CÓDIGO (P0XX) al inicio del nombre → sobrevive a
-- cualquier renombre. Además si una ref no existe, la lista v_falta
-- avisa al final en vez de abortar todo.
--
-- Valores = conteo físico 21-jul con las correcciones de Juan:
--   P057→0, P059→0, P060→7, P061→20, P062→6, P063→4, P064→11,
--   P065→20, P066→24, P067→13, P069→5, P070→0, P071→3, P072→30,
--   y el cruce corregido P008=0 / P010=60.
-- Ajuste por DIFERENCIA vía kardex. Idempotente y auto-correctivo.
--
-- FUERA (a propósito): P081-P083 (nuevas, por aclarar), P076-P080
-- e i3D (no estaban en la hoja).
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
      ('P001',  36),
      ('P002',  81),
      ('P004',  62),
      ('P005',  41),
      ('P003',  29),
      ('P006',  20),
      ('P007', 142),
      ('P008',   0),
      ('P009',  34),
      ('P010',  60),
      ('P011',  17),
      ('P012',  40),
      ('P013',  10),
      ('P014', 114),
      ('P015',  56),
      ('P016',  53),
      ('P017',  64),
      ('P018',  10),
      ('P019',   0),
      ('P020',  23),
      ('P021',   1),
      ('P022',  45),
      ('P024',  44),
      ('P025',  32),
      ('P026',  20),
      ('P027',  51),
      ('P028',  52),
      ('P029',   4),
      ('P030',   0),
      ('P031',  24),
      ('P033',   1),
      ('P034',   1),
      ('P035',   1),
      ('P036',   7),
      ('P037',   7),
      ('P038',   7),
      ('P039',   7),
      ('P040',   7),
      ('P041',   7),
      ('P042',   7),
      ('P043',  18),
      ('P044',   4),
      ('P045',  11),
      ('P046',   2),
      ('P047',  19),
      ('P049',   6),
      ('P050',  74),
      ('P051',   1),
      ('P052',   7),
      ('P053',  15),
      ('P054',   0),
      ('P055',   0),
      ('P056',   0),
      ('P057',   0),
      ('P058',   0),
      ('P059',   0),
      ('P060',   7),
      ('P061',  20),
      ('P062',   6),
      ('P063',   4),
      ('P064',  11),
      ('P065',  20),
      ('P066',  24),
      ('P067',  13),
      ('P069',   5),
      ('P070',   0),
      ('P071',   3),
      ('P072',  30)
    ) as t(codigo, objetivo)
  loop
    -- match por CÓDIGO (P0XX) para no depender del nombre exacto
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
         'Conteo físico 21-jul-2026 v4 (correcciones de Juan 22-jul)');
    end if;
  end loop;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — códigos sin existencia (no ajustados): %', v_falta;
  end if;
end $$;

-- Verificación: saldos tras el ajuste (deben coincidir con el Excel corregido).
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre ~ '^P0'
 order by m.nombre;
