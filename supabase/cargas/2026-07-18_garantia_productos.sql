-- ============================================================
-- GARANTÍA MULTI-ÍTEM: una garantía puede cubrir VARIOS productos
-- de la misma OP (pedido de Juan 18-jul-2026).
-- `garantias.producto_id` se conserva como producto PRINCIPAL
-- (compatibilidad con kanban/listas); el detalle completo vive aquí.
-- Idempotente.
-- ============================================================

create table if not exists garantia_productos (
  id           uuid primary key default gen_random_uuid(),
  garantia_id  uuid not null references garantias(id) on delete cascade,
  producto_id  uuid not null references productos(id),
  cantidad     numeric(12,3) not null default 1 check (cantidad > 0),
  unique (garantia_id, producto_id)
);

alter table garantia_productos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='garantia_productos' and policyname='garantia_productos_sel') then
    create policy garantia_productos_sel on garantia_productos
      for select to authenticated using (fn_puede('produccion','ver'));
  end if;
  if not exists (select 1 from pg_policies where tablename='garantia_productos' and policyname='garantia_productos_ins') then
    create policy garantia_productos_ins on garantia_productos
      for insert to authenticated with check (fn_puede('produccion','crear'));
  end if;
  if not exists (select 1 from pg_policies where tablename='garantia_productos' and policyname='garantia_productos_upd') then
    create policy garantia_productos_upd on garantia_productos
      for update to authenticated using (fn_puede('produccion','editar')) with check (fn_puede('produccion','editar'));
  end if;
end $$;

select 'garantia_productos lista' as ok;
