-- ============================================================
-- ANULAR OP (pedido de Juan 19-jul-2026, pensado para limpiar
-- pruebas del ERP y para cancelaciones reales futuras).
--
-- Reglas:
--   · Solo Admin (produccion.aprobar).
--   · Motivo obligatorio (trazabilidad).
--   · No se puede anular una OP entregada ni con despachos
--     registrados (primero deshacer los despachos).
--   · Si la OP ya pasó por Corte (BOM descontado), se REVERSA el
--     inventario con movimientos 'entrada_produccion' espejo de
--     las salidas reales — las platinas vuelven al stock.
--     mp_descontada_en NO se limpia (el trigger lo prohíbe y la
--     OP queda anulada, nunca vuelve a descontar).
--   · La OP no se borra: activo=false + anulada_en/motivo/por.
--     Desaparece de tablero y dashboards; queda en el Archivo.
-- Idempotente.
-- ============================================================

alter table ordenes_pedido add column if not exists anulada_en timestamptz;
alter table ordenes_pedido add column if not exists anulada_motivo text;
alter table ordenes_pedido add column if not exists anulada_por uuid references usuarios(id);

create or replace function fn_anular_op(p_op_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_op    ordenes_pedido%rowtype;
  v_desp  int;
begin
  if auth.uid() is not null and not fn_puede('produccion','aprobar') then
    raise exception 'Solo un Administrador puede anular una OP';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo de anulación es obligatorio';
  end if;

  select * into v_op from ordenes_pedido where id = p_op_id for update;
  if not found then
    raise exception 'La OP no existe';
  end if;
  if v_op.anulada_en is not null then
    raise exception 'La OP % ya está anulada', v_op.numero;
  end if;
  if not v_op.activo then
    raise exception 'La OP % no está activa', v_op.numero;
  end if;
  if v_op.fecha_entregada is not null then
    raise exception 'La OP % ya fue entregada — no se puede anular', v_op.numero;
  end if;

  select count(*) into v_desp
    from op_despachos d
    join op_items i on i.id = d.op_item_id
   where i.op_id = p_op_id;
  if v_desp > 0 then
    raise exception 'La OP % tiene % despacho(s) registrado(s): deshágalos primero desde el detalle', v_op.numero, v_desp;
  end if;

  -- Reversa del BOM: espejo exacto de las salidas que hizo
  -- fn_descontar_bom (aunque el BOM haya cambiado después).
  if v_op.mp_descontada_en is not null then
    insert into movimientos_inventario (existencia_id, tipo, cantidad, op_id, usuario_id, nota)
    select m.existencia_id, 'entrada_produccion', -m.cantidad, p_op_id, auth.uid(),
           'Reversa BOM por anulación de la OP ' || v_op.numero
      from movimientos_inventario m
     where m.op_id = p_op_id and m.tipo = 'salida_produccion';
  end if;

  update ordenes_pedido
     set activo         = false,
         eliminado_en   = now(),
         anulada_en     = now(),
         anulada_motivo = trim(p_motivo),
         anulada_por    = auth.uid()
   where id = p_op_id;

  insert into op_observaciones (op_id, usuario_id, texto)
  values (p_op_id, auth.uid(), 'OP ANULADA · ' || trim(p_motivo));
end $$;

revoke all on function fn_anular_op(uuid, text) from public;
grant execute on function fn_anular_op(uuid, text) to authenticated;

select 'fn_anular_op lista' as ok;
