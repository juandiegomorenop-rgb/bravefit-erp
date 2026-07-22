-- ============================================================
-- CORRECCIONES A LAS OPs YA CARGADAS (OP_WA_0001-0015) — 22-jul
-- ============================================================
-- Hallazgos al cruzar los formatos físicos contra la BD, con las
-- decisiones de Juan del 22-jul:
--
--  1. OP_WA_0011 Kevin Criollo → requiere_instalacion = true
--     (el formato dice manuscrito "CON INSTALACION Y TTE").
--  2. OP_WA_0005 Fidel Barrio Zarate → observación "FALTA UNION A
--     PARED" (falta fabricarla para poder despachar).
--  3. OP_WA_0003 Diego Alejandro Sanchez → observación: columna
--     confirmada en 2.2m (el impreso decia 2m, corregido a mano).
--  4. OP_WA_0008 Juan Carlos Rodriguez → observación "SEGUROS PARA
--     OLIMPICA: 2 ADICIONALES".
--  5. 🔑 MARCA "NO DESCONTAR INVENTARIO" en las 4 OPs ya cargadas
--     que YA ESTABAN EN PROCESO cuando arrancó el ERP: sus platinas
--     se consumieron ANTES (el conteo físico del 21-jul ya lo
--     refleja). Se pre-estampa `mp_descontada_en` para que
--     fn_descontar_bom las vea como ya descontadas y NO toque el
--     inventario cuando Julián las mueva por el kanban.
--     → OP_WA_0003 · OP_WA_0005 · OP_WA_0008 · OP_WA_0014
--
-- Idempotente: las observaciones no se duplican y la marca solo se
-- estampa si está vacía.
-- ============================================================

do $$
declare
  v_user uuid;
  r record;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  -- ---- 1. Kevin Criollo: sí lleva instalación -------------
  update ordenes_pedido set requiere_instalacion = true
   where numero = 'OP_WA_0011' and requiere_instalacion is distinct from true;

  -- ---- 2-4. Observaciones de producción --------------------
  for r in
    select * from (values
      ('OP_WA_0005','FALTA UNION A PARED: falta fabricarla para poder despachar (nota del formato fisico).'),
      ('OP_WA_0003','Columna confirmada en 2.2m (el formato impreso decia 2m, corregido a mano por produccion).'),
      ('OP_WA_0008','Seguros para barra olimpica: 2 adicionales (nota manuscrita del formato).')
    ) as t(numero, texto)
  loop
    insert into op_observaciones (op_id, usuario_id, texto, via)
    select o.id, v_user, r.texto, 'app'
      from ordenes_pedido o
     where o.numero = r.numero
       and not exists (
         select 1 from op_observaciones ob
          where ob.op_id = o.id and ob.texto = r.texto);
  end loop;

  -- ---- 5. Marca "ya descontó BOM" (NO mover inventario) ----
  -- El trigger exige el GUC bravefit.bom para escribir esta columna.
  perform set_config('bravefit.bom', '1', true);
  update ordenes_pedido
     set mp_descontada_en = timestamptz '2026-07-01 08:00:00-05'
   where numero in ('OP_WA_0003','OP_WA_0005','OP_WA_0008','OP_WA_0014')
     and mp_descontada_en is null;
  perform set_config('bravefit.bom', '', true);
end $$;

-- Verificación 1: Kevin con instalación, y las 4 con la marca puesta.
select numero, requiere_instalacion, mp_descontada_en
  from ordenes_pedido
 where numero in ('OP_WA_0003','OP_WA_0005','OP_WA_0008','OP_WA_0011','OP_WA_0014')
 order by numero;

-- Verificación 2: las observaciones nuevas.
select o.numero, ob.texto
  from op_observaciones ob
  join ordenes_pedido o on o.id = ob.op_id
 where o.numero in ('OP_WA_0003','OP_WA_0005','OP_WA_0008')
 order by o.numero;
