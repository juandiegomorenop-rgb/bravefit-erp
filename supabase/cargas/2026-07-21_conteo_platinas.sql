-- ============================================================
-- CONTEO FÍSICO DE PLATINAS — 21-jul-2026 (hoja física de Juan)
-- ============================================================
-- Ajusta las 67 referencias contadas a su valor físico registrando
-- un movimiento 'ajuste' por la DIFERENCIA contra el saldo actual
-- (traza completa en kardex). Idempotente: saldo ya correcto → no
-- registra nada.
--
-- Incluye la corrección del CRUCE P008/P010: el conteo inicial del
-- 16-jul las tenía invertidas (P008=38 y P010=0; lo físico es
-- P008=0 y P010=60).
--
-- FUERA de este script (a propósito):
--   · P072 (target doble): la hoja no traía cantidad legible; queda
--     con su saldo actual hasta que Juan la cuente.
--   · P081-P083 (corazón poleas / alm. 5 elásticos / espaldar dap
--     bar): referencias nuevas manuscritas, Juan debe aclararlas.
--   · P076-P080 e i3D001/i3D002: no estaban en la hoja del conteo.
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
      ('P001 · Platina base',                                          36),
      ('P002 · Platina barra sencilla',                                81),
      ('P004 · Platina pie amigo barra sencilla',                      62),
      ('P005 · Platina xbean',                                         41),
      ('P003 · Platina en C landmine',                                 29),
      ('P006 · Platina xbean pequeña',                                 20),
      ('P007 · Platina unión triangular',                             142),
      ('P008 · Platina soporte seguridad sentadilla',                   0),
      ('P009 · Platina pie amigo soporte seguridad sentadilla',        34),
      ('P010 · Platina seguridad soporte seguridad sentadilla',        60),
      ('P011 · Platina pin jlock',                                     17),
      ('P012 · Platina aleta jlock',                                   40),
      ('P013 · Platina seguridad jlock',                               10),
      ('P014 · Platina nivelador',                                    114),
      ('P015 · Platina almacenador disco a rack',                      56),
      ('P016 · Platina almacenador de 2 barras',                       53),
      ('P017 · Platina tope leg roller',                               64),
      ('P018 · Platina tapa leg roller',                               10),
      ('P019 · Platina fondo en rack',                                  0),
      ('P020 · Platina separador fondo a rack',                        23),
      ('P021 · Platina tapa polea',                                     1),
      ('P022 · Platina triangular de polea superior e inferior',       45),
      ('P024 · Platina inferior guías polea',                          44),
      ('P025 · Platina superior guía polea graduable',                 32),
      ('P026 · Platina separador pesos bloques',                       20),
      ('P027 · Platina en X guía en columna',                          51),
      ('P028 · Platina en C para guía en X en columna',                52),
      ('P029 · Platina bloque peso polea superior',                     4),
      ('P030 · Platina bloque peso polea intermedio',                   0),
      ('P031 · Platina hqroller',                                      24),
      ('P033 · Platina target',                                         1),
      ('P034 · Platina alargue target',                                 1),
      ('P035 · Platina soldar en target para alargue',                  1),
      ('P036 · Platina centro basculación banco reclinable',            7),
      ('P037 · Platina asiento banco reclinable',                       7),
      ('P038 · Platina espaldar banco reclinable',                      7),
      ('P039 · Platina en C soporte asiento banco reclinable',          7),
      ('P040 · Platina en C soporte espaldar banco reclinable',         7),
      ('P041 · Platina en C posiciones asiento banco reclinable',       7),
      ('P042 · Platina en C posiciones espaldar banco reclinable',      7),
      ('P043 · Platina pared pf5 abatible',                            18),
      ('P044 · Platina sanduche pf5 abatible',                          4),
      ('P045 · Platina en C barra desmontable pf5 abatible',           11),
      ('P046 · Platina con ángulo para terminación de tubos base',      2),
      ('P047 · Platina llantas',                                       19),
      ('P049 · Platina gancho trx',                                     6),
      ('P050 · Platina gancho almacenador',                            74),
      ('P051 · Platina pared fondo abatible',                           1),
      ('P052 · Platina soldar en platina pared fondo abatible',         7),
      ('P053 · Platina de tubo fondo abatible',                        15),
      ('P054 · Platina pared dc bar',                                   0),
      ('P055 · Platina pull up dc bar',                                 0),
      ('P056 · Platina pie amigo pull up dc bar',                       0),
      ('P057 · Platina pared dap bar',                                  8),
      ('P058 · Platina gancho platina pared dap bar',                   0),
      ('P059 · Platina unión dap bar',                                  7),
      ('P060 · Platina pull up dap bar',                               20),
      ('P061 · Platina doble tapa polea',                               6),
      ('P062 · Platina almacenador 3 barras',                           4),
      ('P063 · Platina almacenador 5 barras',                          11),
      ('P064 · Almacenador de agarres',                                20),
      ('P065 · Platinas en L para guías smith tradicional',             1),
      ('P066 · Platinas basculante almacenador de mancuernas',         13),
      ('P067 · Platina gancho smith',                                   5),
      ('P069 · Platina rack pad',                                       0),
      ('P070 · Platina X para carro integrado',                         3),
      ('P071 · Platina porta discos sistema de poleas',                30)
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
         'Conteo físico 21-jul-2026 (incluye corrección cruce P008/P010)');
    end if;
  end loop;
end $$;

-- Verificación: saldos tras el ajuste (deben coincidir con la hoja).
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre ~ '^P0'
 order by m.nombre;
