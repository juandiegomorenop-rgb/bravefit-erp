-- ============================================================
-- QUÉ VENDE CADA PROVEEDOR (pedido de Juan 20-jul-2026):
-- el selector de proveedor en Compras se filtra por el tipo de
-- material de la solicitud (no ofrecer un proveedor de tubería
-- para comprar platinas — evita errores de digitación).
--
-- Esta tabla se NUTRE con la lista de proveedores que Juan pasa:
-- una fila por (proveedor, tipo que vende). Un proveedor SIN
-- filas aparece en todos los selectores (fallback hasta nutrirlo).
-- Idempotente.
-- ============================================================

create table if not exists proveedor_tipos_material (
  proveedor_id     uuid not null references proveedores(id) on delete cascade,
  tipo_material_id smallint not null references tipos_material(id),
  primary key (proveedor_id, tipo_material_id)
);

alter table proveedor_tipos_material enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'proveedor_tipos_material'
                    and policyname = 'ptm_sel') then
    create policy ptm_sel on proveedor_tipos_material
      for select to authenticated using (fn_puede('produccion','ver'));
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'proveedor_tipos_material'
                    and policyname = 'ptm_mod') then
    create policy ptm_mod on proveedor_tipos_material
      for all to authenticated
      using (fn_puede('produccion','editar'))
      with check (fn_puede('produccion','editar'));
  end if;
end $$;

select 'proveedor_tipos_material lista' as ok;
