-- ============================================================
-- CARGA INICIAL DE PLATINAS — conteo físico del 16-jul-2026
-- ============================================================
-- VERSIÓN FINAL — solo referencias con conteo CONFIRMADO por Juan.
-- Quedan FUERA (entran luego, cuando Juan pase los números escritos):
--   P062 · Platina almacenador 3 barras
--   P065–P072 (en L smith, basculante mancuernas, gancho smith,
--   rack pad, X carro integrado, porta discos, target doble)
--
-- Qué hace (idempotente — correrlo dos veces no duplica nada):
--   1. Crea cada platina en `materiales` (tipo Platinería, unidad und,
--      costo 0 y buffers 0 por ahora — se definen luego con el consumo).
--   2. Crea su `existencia` de materia prima en 0 (regla: los saldos
--      solo entran por el kardex).
--   3. Registra el conteo como movimiento 'ajuste' con nota fechada;
--      el trigger fn_aplicar_movimiento actualiza el saldo.
--      Conteos en 0 no generan movimiento (la BD prohíbe cantidad = 0).
--
-- Cómo ejecutarlo: Supabase → SQL Editor → pegar todo → Run.
-- ============================================================

do $$
declare
  v_tipo smallint;
  v_und  smallint;
  v_user uuid;
  v_mat  uuid;
  v_ex   uuid;
  v_nota constant text := 'Conteo físico 16-jul-2026 · carga inicial';
  r record;
begin
  select id into strict v_tipo from tipos_material where nombre = 'Platinería';
  select id into strict v_und  from unidades_medida where clave = 'und';
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  for r in
    select * from (values
      -- ---------- Hoja 1 (confirmada) ----------
      ('P001 · Platina base',                                          38),
      ('P002 · Platina barra sencilla',                               107),
      ('P003 · Platina en C landmine',                                  9),
      ('P004 · Platina pie amigo barra sencilla',                      66),
      ('P005 · Platina xbean',                                          0),
      ('P006 · Platina xbean pequeña',                                 18),
      ('P007 · Platina unión triangular',                             142),
      ('P008 · Platina soporte seguridad sentadilla',                  38),
      ('P009 · Platina pie amigo soporte seguridad sentadilla',        34),
      ('P010 · Platina seguridad soporte seguridad sentadilla',         0),
      ('P011 · Platina pin jlock',                                     12),
      ('P012 · Platina aleta jlock',                                    1),
      ('P013 · Platina seguridad jlock',                               10),
      ('P014 · Platina nivelador',                                    102),
      ('P015 · Platina almacenador disco a rack',                      56),
      ('P016 · Platina almacenador de 2 barras',                       26),
      ('P017 · Platina tope leg roller',                                4),
      ('P018 · Platina tapa leg roller',                               51),
      ('P019 · Platina fondo en rack',                                  0),
      ('P020 · Platina separador fondo a rack',                        22),
      ('P021 · Platina tapa polea',                                     4),
      ('P022 · Platina triangular de polea superior e inferior',       40),
      ('P024 · Platina inferior guías polea',                          44),
      ('P025 · Platina superior guía polea graduable',                 32),
      ('P026 · Platina separador pesos bloques',                        0),
      ('P027 · Platina en X guía en columna',                          30),
      ('P028 · Platina en C para guía en X en columna',                15),
      ('P029 · Platina bloque peso polea superior',                     5),
      ('P030 · Platina bloque peso polea intermedio',                   5),
      ('P031 · Platina hqroller',                                      24),
      ('P033 · Platina target',                                         1),
      ('P034 · Platina alargue target',                                 1),
      ('P035 · Platina soldar en target para alargue',                  1),
      ('P036 · Platina centro basculación banco reclinable',            0),
      -- ---------- Hoja 2 (confirmada hasta P064) ----------
      ('P037 · Platina asiento banco reclinable',                       0),
      ('P038 · Platina espaldar banco reclinable',                      0),
      ('P039 · Platina en C soporte asiento banco reclinable',          0),
      ('P040 · Platina en C soporte espaldar banco reclinable',         0),
      ('P041 · Platina en C posiciones asiento banco reclinable',       0),
      ('P042 · Platina en C posiciones espaldar banco reclinable',      0),
      ('P043 · Platina pared pf5 abatible',                             4),
      ('P044 · Platina sanduche pf5 abatible',                         18),
      ('P045 · Platina en C barra desmontable pf5 abatible',            3),
      ('P046 · Platina con ángulo para terminación de tubos base',      2),
      ('P047 · Platina llantas',                                       26),
      ('P049 · Platina gancho trx',                                     6),
      ('P050 · Platina gancho almacenador',                            90),
      ('P051 · Platina pared fondo abatible',                           1),
      ('P052 · Platina soldar en platina pared fondo abatible',         7),
      ('P053 · Platina de tubo fondo abatible',                        15),
      ('P054 · Platina pared dc bar',                                   4),
      ('P055 · Platina pull up dc bar',                                 4),
      ('P056 · Platina pie amigo pull up dc bar',                       4),
      ('P057 · Platina pared dap bar',                                  1),
      ('P058 · Platina gancho platina pared dap bar',                   2),
      ('P059 · Platina unión dap bar',                                  2),
      ('P060 · Platina pull up dap bar',                                0),
      ('P061 · Platina doble tapa polea',                               7),
      ('P063 · Platina almacenador 5 barras',                           9),
      ('P064 · Almacenador de agarres',                                 0)
    ) as t(nombre, cantidad)
  loop
    -- 1 · Material (idempotente vía unique (nombre, tipo_material_id))
    insert into materiales (nombre, tipo_material_id, unidad_id,
                            costo_promedio, buffer_min, buffer_max)
    values (r.nombre, v_tipo, v_und, 0, 0, 0)
    on conflict (nombre, tipo_material_id) do nothing;

    select id into strict v_mat
      from materiales
     where nombre = r.nombre and tipo_material_id = v_tipo;

    -- 2 · Existencia en cero (el saldo solo entra por el kardex)
    insert into existencias (material_id, tipo,
                             cantidad_disponible, cantidad_reservada)
    values (v_mat, 'materia_prima', 0, 0)
    on conflict (material_id, tipo) do nothing;

    select id into strict v_ex
      from existencias
     where material_id = v_mat and tipo = 'materia_prima';

    -- 3 · Conteo como ajuste (solo si > 0 y no se cargó ya)
    if r.cantidad > 0 and not exists (
      select 1 from movimientos_inventario
       where existencia_id = v_ex and tipo = 'ajuste' and nota = v_nota
    ) then
      insert into movimientos_inventario
        (existencia_id, tipo, cantidad, usuario_id, nota)
      values (v_ex, 'ajuste', r.cantidad, v_user, v_nota);
    end if;
  end loop;
end $$;

-- Verificación rápida tras ejecutar: debe devolver 60 filas con su saldo.
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.tipo_material_id = (select id from tipos_material where nombre = 'Platinería')
 order by m.nombre;
