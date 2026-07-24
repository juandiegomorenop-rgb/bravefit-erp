-- ============================================================
-- SOLICITUDES DE COMPRA retroactivas — Juan 24-jul-2026
-- ============================================================
-- Pedidos que existían FUERA del ERP (el módulo de compras no estaba
-- listo cuando se pidieron). Se cargan para que el sistema sepa que el
-- material viene, y para recibirlos por la pantalla de recepción cuando
-- lleguen (ahí suben al kardex).
--
--   SC-A · Pedido del 17-jul  → estado COMPRADO (en camino)
--   SC-B · Resto del pedido de poleas del 1-jul → COMPRADO (en camino)
--          (el parcial que ya llegó y se despachó NO se carga: entró y
--           salió sin tocar el ERP; el saldo actual ya lo refleja)
--   SC-C · Pedido NUEVO (las 55 platinas) → estado PENDIENTE (aún no se pide)
--
-- Todas son Platinería, solicitante Juan. valor y fecha van NULL (no hay
-- factura aún): se pueden editar luego; la recepción no los exige.
--
-- ⚠️ Las líneas de BANCO del 17-jul se cargaron para 2 BANCOS COMPLETOS
-- (P036×4, P037-P042×2). Verificar contra el pedido real antes de recibir.
--
-- Idempotente: cada SC lleva una marca en notas y no se duplica al re-correr.
-- ============================================================

do $$
declare
  v_user  uuid;
  v_tipo  smallint;
  v_sc    uuid;
  v_mat   uuid;
  v_falta text := '';
  r record;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';
  select id into strict v_tipo from tipos_material where nombre = 'Platinería';

  -- ---- SC-A · PEDIDO DEL 17-JUL (comprado, en camino) --------
  if not exists (select 1 from solicitudes_compra where notas like '%[carga:17jul]%') then
    insert into solicitudes_compra (numero, tipo_material_id, solicitante_id, estado, notas)
    values (fn_siguiente_numero('sc'), v_tipo, v_user, 'comprado',
            'Pedido del 17-jul cargado retroactivamente (el módulo de compras no existía). '
            'Banco = 2 bancos completos (verificar). [carga:17jul]')
    returning id into v_sc;

    for r in
      select * from (values
        ('P005',101),('P006',3),('P012',39),('P013',30),('P011',28),
        ('P030',124),('P029',3),
        ('P036',4),('P037',2),('P038',2),('P039',2),('P040',2),('P041',2),('P042',2),
        ('P026',16),('P027',13),('P021',12),('P028',7),('P019',16),
        ('P043',4),('P056',2),('P045',1)
      ) as t(codigo, cant)
    loop
      select id into v_mat from materiales where nombre like r.codigo || ' ·%';
      if v_mat is null then v_falta := v_falta || 'A:' || r.codigo || ' '; continue; end if;
      insert into sc_items (sc_id, material_id, cantidad) values (v_sc, v_mat, r.cant);
    end loop;
  end if;

  -- ---- SC-B · RESTO DE POLEAS DEL 1-JUL (comprado, en camino) -
  if not exists (select 1 from solicitudes_compra where notas like '%[carga:1jul-poleas]%') then
    insert into solicitudes_compra (numero, tipo_material_id, solicitante_id, estado, notas)
    values (fn_siguiente_numero('sc'), v_tipo, v_user, 'comprado',
            'Resto del pedido de bloques de polea del 1-jul (llegó parcial el 23-jul: '
            '68 P030 + 4 P029, ya despachados). Esto es lo que falta. [carga:1jul-poleas]')
    returning id into v_sc;

    for r in
      select * from (values ('P030',68),('P029',4)) as t(codigo, cant)
    loop
      select id into v_mat from materiales where nombre like r.codigo || ' ·%';
      if v_mat is null then v_falta := v_falta || 'B:' || r.codigo || ' '; continue; end if;
      insert into sc_items (sc_id, material_id, cantidad) values (v_sc, v_mat, r.cant);
    end loop;
  end if;

  -- ---- SC-C · PEDIDO NUEVO, LAS 55 (pendiente) ---------------
  if not exists (select 1 from solicitudes_compra where notas like '%[carga:nuevo-10ops]%') then
    insert into solicitudes_compra (numero, tipo_material_id, solicitante_id, estado, notas)
    values (fn_siguiente_numero('sc'), v_tipo, v_user, 'pendiente',
            'Platinas para las 10 OP siguientes, netas de lo que viene del 1-jul y 17-jul. '
            'Avanzar a comprada al colocarla. [carga:nuevo-10ops]')
    returning id into v_sc;

    for r in
      select * from (values
        ('P044',12),('P058',4),('P034',3),('P046',2),('P078',2),('P080',2),
        ('P021',1),('P033',1),('P035',1),('P057',1),('P059',1),('P076',1),
        ('P036',6),('P037',3),('P038',3),('P039',3),('P040',3),('P041',3),('P042',3)
      ) as t(codigo, cant)
    loop
      select id into v_mat from materiales where nombre like r.codigo || ' ·%';
      if v_mat is null then v_falta := v_falta || 'C:' || r.codigo || ' '; continue; end if;
      insert into sc_items (sc_id, material_id, cantidad) values (v_sc, v_mat, r.cant);
    end loop;
  end if;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — códigos no encontrados (líneas omitidas): %', v_falta;
  end if;
end $$;

-- Verificación: las 3 SC con su estado y cuántas líneas quedaron.
select s.numero, s.estado, s.notas, count(i.id) as lineas, sum(i.cantidad) as total_platinas
  from solicitudes_compra s
  join sc_items i on i.sc_id = s.id
 where s.notas like '%[carga:17jul]%'
    or s.notas like '%[carga:1jul-poleas]%'
    or s.notas like '%[carga:nuevo-10ops]%'
 group by s.numero, s.estado, s.notas
 order by s.numero;
