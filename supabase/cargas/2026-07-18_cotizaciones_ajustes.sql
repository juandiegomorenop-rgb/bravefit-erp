-- ============================================================
-- COTIZACIONES EN VIVO — ajustes de base (18-jul-2026)
-- 1) Editar un Borrador reemplaza sus ítems → hace falta la policy
--    DELETE de cotizacion_items (el template solo creó sel/ins/upd).
-- 2) Consecutivo BFP: la secuencia arranca en 100, pero el planner ya
--    emitió números más altos. AJUSTA el número al siguiente LIBRE
--    según tu consecutivo real del planner antes de correr.
-- Idempotente.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename='cotizacion_items' and policyname='cotizacion_items_del') then
    create policy cotizacion_items_del on cotizacion_items
      for delete to authenticated using (fn_puede('ventas','editar'));
  end if;
end $$;

-- ⚠️ CAMBIA 200 por el siguiente número LIBRE de tu consecutivo BFP
-- (si la última cotización del planner fue BFP-0157, pon 158).
update secuencias set siguiente = 200 where clave = 'cotizacion';

select clave, prefijo, siguiente from secuencias where clave = 'cotizacion';
