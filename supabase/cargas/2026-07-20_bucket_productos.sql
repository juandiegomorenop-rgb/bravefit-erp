-- ============================================================
-- FOTOS DE PRODUCTOS EN STORAGE (pedido de Juan 20-jul-2026).
-- Hasta hoy las imágenes vivían en el repo (app/public/productos)
-- y subir una exigía un deploy. Con este bucket las sube el
-- equipo desde el ERP y quedan disponibles al instante.
--
-- Bucket PÚBLICO a propósito: las fotos salen en cotizaciones,
-- PDFs y el planner; son catálogo comercial, no dato sensible.
-- Escribir exige permiso de Ventas (Admins).
-- Idempotente.
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('productos', 'productos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'objects' and policyname = 'prod_ins') then
    create policy prod_ins on storage.objects for insert to authenticated
      with check (bucket_id = 'productos' and fn_puede('ventas','editar'));
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'objects' and policyname = 'prod_upd') then
    create policy prod_upd on storage.objects for update to authenticated
      using (bucket_id = 'productos' and fn_puede('ventas','editar'));
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'objects' and policyname = 'prod_del') then
    create policy prod_del on storage.objects for delete to authenticated
      using (bucket_id = 'productos' and fn_puede('ventas','editar'));
  end if;
end $$;

select id, name, public from storage.buckets where id = 'productos';
