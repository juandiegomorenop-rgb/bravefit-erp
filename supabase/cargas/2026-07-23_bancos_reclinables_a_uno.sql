-- ============================================================
-- BANCOS RECLINABLES: el inventario baja de 9 a 1 (Juan 23-jul-2026)
-- ============================================================
-- El 22-jul se cargaron 9 estructuras de banco reclinable. Ese número
-- incluía bancos que TODAVÍA SE ESTÁN FABRICANDO, y sus platinas ya
-- estaban contadas aparte: el mismo banco quedaba contado dos veces.
--
-- Conteo real de Juan el 23-jul:
--     4 completos en proceso  → NO son inventario (están en fabricación)
--     3 armados esperando la platina basculante → NO son inventario
--     1 terminado y empacado  → SÍ es inventario
--
-- Regla que queda escrita: LO QUE ESTÁ EN FABRICACIÓN NO ES INVENTARIO.
-- Los otros 7 se siguen en el tablero de producción, no en el saldo.
--
-- OJO: NO devuelve platinas al inventario. Las 9 se habían sumado sin
-- descontar nada, así que quitar las 8 fantasma no tiene contrapartida.
-- El saldo real de P036-P042 queda pendiente del reconteo de Juan.
--
-- Idempotente: si ya está en 1, no hace nada.
-- ============================================================

do $$
declare
  v_user  uuid;
  v_ex    uuid;
  v_delta numeric;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  select e.id, 1 - e.cantidad_disponible
    into v_ex, v_delta
    from existencias e
    join productos p on p.id = e.producto_id
   where p.sku = 'SE-EST-BANCOREC' and e.tipo = 'subensamble';

  if not found then
    raise exception 'No existe la existencia de SE-EST-BANCOREC';
  end if;

  if v_delta <> 0 then
    insert into movimientos_inventario
      (existencia_id, tipo, cantidad, usuario_id, nota)
    values
      (v_ex, 'ajuste', v_delta, v_user,
       'Conteo 23-jul-2026: solo 1 banco terminado y empacado. Los otros 7 '
       '(4 en proceso + 3 esperando platina basculante) están en fabricación '
       'y no son inventario.');
  end if;
end $$;

-- Verificación: estructuras = 1, y cuántos juegos completos salen con cojín.
select 'Estructura banco reclinable' as concepto,
       (select e.cantidad_disponible from existencias e
          join productos p on p.id = e.producto_id
         where p.sku = 'SE-EST-BANCOREC' and e.tipo = 'subensamble') as estructuras,
       (select e.cantidad_disponible from existencias e
          join materiales m on m.id = e.material_id
         where m.nombre like 'COJ004%') as cojines;
