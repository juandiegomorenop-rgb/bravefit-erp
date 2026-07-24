-- ============================================================
-- 0005 · fn_fabricar_subensamble — dar de ALTA lo fabricado
-- ============================================================
-- Hasta hoy el ERP no tenía NINGUNA forma de sumar algo fabricado:
-- `entrada_produccion` existía en el CHECK del kardex pero solo se
-- usaba como reversa en fn_anular_op. Esta es esa pieza.
--
-- En UNA transacción, al declarar "fabriqué N columnas":
--     1. SUBE  N al estante del subensamble   (entrada_produccion)
--     2. BAJAN sus materiales según la receta (salida_produccion)
--
-- Regla acordada con Juan (23-jul): TODO lo fabricado pasa por el
-- estante, aunque dure un segundo. Aunque la columna se corte para un
-- pedido puntual, entra y sale — así hay una sola regla, el histórico
-- queda auditable y los metros de tubo perforado quedan contados en el
-- mes en que se perforaron (que es como Juan definió el indicador).
--
-- EL CANDADO ES LA BASE DE DATOS: el CHECK `cantidad_disponible >= 0`
-- de `existencias` aborta toda la transacción si no alcanzan las
-- platinas. Es estructuralmente imposible fabricar sin material, que
-- es justo el error que se cometió a mano el 22-jul (9 estructuras de
-- banco donde solo había material para 8).
--
-- NO explota recursivamente: si un subensamble llevara otro dentro,
-- consume ese otro del estante, no sus materiales. La frontera es
-- estructural, igual que en las OPs.
-- ============================================================

create or replace function fn_fabricar_subensamble(
  p_producto_id uuid,
  p_cantidad    numeric,
  p_nota        text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ex        uuid;
  v_tipo      text;
  v_es_sub    boolean;
  v_nombre    text;
  v_lineas    int;
  v_faltantes text;
  v_nota      text;
  v_mov       bigint;
begin
  if auth.uid() is not null and not fn_puede('produccion','crear') then
    raise exception 'Sin permiso para registrar fabricación';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad fabricada debe ser mayor que cero';
  end if;

  select nombre, es_subensamble into v_nombre, v_es_sub
    from productos where id = p_producto_id and activo;
  if v_nombre is null then
    raise exception 'El producto no existe o está inactivo';
  end if;

  -- La receta debe existir: sin ella esto sería sumar de la nada, que
  -- es exactamente el error que estamos corrigiendo.
  select count(*) into v_lineas
    from producto_componentes
   where producto_id = p_producto_id and material_id is not null;
  if v_lineas = 0 then
    raise exception
      '% no tiene receta cargada: no se puede fabricar sin saber qué consume', v_nombre;
  end if;

  -- Materiales de la receta que ni siquiera tienen existencia abierta.
  select string_agg(distinct m.nombre, ', ') into v_faltantes
    from producto_componentes pc
    join materiales m on m.id = pc.material_id
    left join existencias e on e.material_id = pc.material_id
                           and e.tipo = 'materia_prima'
   where pc.producto_id = p_producto_id
     and pc.material_id is not null
     and e.id is null;
  if v_faltantes is not null then
    raise exception 'Materiales de la receta sin existencia registrada: %', v_faltantes;
  end if;

  v_tipo := case when v_es_sub then 'subensamble' else 'terminado' end;
  v_nota := coalesce(nullif(btrim(p_nota), ''), 'Fabricación registrada');

  -- Existencia del subensamble: nace en cero, el saldo lo pone el kardex.
  select id into v_ex
    from existencias
   where producto_id = p_producto_id and tipo = v_tipo;
  if v_ex is null then
    insert into existencias (producto_id, tipo, cantidad_disponible, cantidad_reservada)
    values (p_producto_id, v_tipo, 0, 0)
    returning id into v_ex;
  end if;

  -- 1) ENTRADA primero. Si en el mismo movimiento algo lo consumiera,
  --    el CHECK >= 0 tumbaría la transacción al restar sobre cero.
  insert into movimientos_inventario
    (existencia_id, tipo, cantidad, usuario_id, nota)
  values
    (v_ex, 'entrada_produccion', p_cantidad, auth.uid(), v_nota)
  returning id into v_mov;

  -- 2) SALIDA de los materiales de la receta. Una fila por material
  --    (agrupada, por si la receta repite el mismo material en dos
  --    líneas). Si no alcanza, el CHECK aborta TODO: no queda un
  --    subensamble fantasma sin su materia prima.
  insert into movimientos_inventario
    (existencia_id, tipo, cantidad, usuario_id, nota)
  select e.id, 'salida_produccion', -sum(pc.cantidad * p_cantidad), auth.uid(),
         v_nota || ' — consumo de receta de ' || v_nombre
    from producto_componentes pc
    join existencias e on e.material_id = pc.material_id
                      and e.tipo = 'materia_prima'
   where pc.producto_id = p_producto_id
     and pc.material_id is not null
   group by e.id
   order by e.id;   -- orden canónico: evita deadlocks entre fabricaciones simultáneas

  return v_mov;
end $$;

comment on function fn_fabricar_subensamble is
  'Declara fabricación: sube el subensamble al estante y baja su receta, '
  'en una sola transacción. El CHECK cantidad_disponible >= 0 hace '
  'imposible fabricar sin material.';

revoke all on function fn_fabricar_subensamble(uuid, numeric, text) from public;
grant execute on function fn_fabricar_subensamble(uuid, numeric, text) to authenticated;
