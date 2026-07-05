-- ============================================================
-- ERP BRAVEFIT · Migración 0003 · Storage
-- La fila de empleados_confidencial protege la URL como dato;
-- esto protege EL ARCHIVO. Buckets privados + políticas sobre
-- storage.objects espejo del RLS de las tablas. Los PDFs se
-- sirven con URLs firmadas de corta vida generadas en el server.
-- ============================================================

insert into storage.buckets (id, name, public) values
  ('hojas-vida',   'hojas-vida',   false),  -- PDFs de empleados_confidencial
  ('cv-aspirantes','cv-aspirantes',false),  -- CVs de aplicaciones (reclutamiento)
  ('catalogos',    'catalogos',    true ),  -- portadas e imágenes de catálogo (público)
  ('adjuntos-op',  'adjuntos-op',  false),  -- fotos/planos adjuntos a OPs y garantías
  ('cartelera',    'cartelera',    false)   -- imágenes de publicaciones y comentarios
on conflict (id) do nothing;

-- hojas de vida: solo RRHH completo (Admin)
create policy hv_sel on storage.objects for select to authenticated
  using (bucket_id = 'hojas-vida' and fn_puede('rrhh','ver'));
create policy hv_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'hojas-vida' and fn_puede('rrhh','editar'));
create policy hv_upd on storage.objects for update to authenticated
  using (bucket_id = 'hojas-vida' and fn_puede('rrhh','editar'));
create policy hv_del on storage.objects for delete to authenticated
  using (bucket_id = 'hojas-vida' and fn_puede('rrhh','editar'));

-- CVs de aspirantes: solo RRHH
create policy cv_sel on storage.objects for select to authenticated
  using (bucket_id = 'cv-aspirantes' and fn_puede('rrhh','ver'));
create policy cv_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-aspirantes' and fn_puede('rrhh','editar'));
create policy cv_del on storage.objects for delete to authenticated
  using (bucket_id = 'cv-aspirantes' and fn_puede('rrhh','editar'));

-- catálogos: lectura pública (bucket public), escribe ventas
create policy cat_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogos' and fn_puede('ventas','editar'));
create policy cat_upd on storage.objects for update to authenticated
  using (bucket_id = 'catalogos' and fn_puede('ventas','editar'));
create policy cat_del on storage.objects for delete to authenticated
  using (bucket_id = 'catalogos' and fn_puede('ventas','editar'));

-- adjuntos de OP/garantías: quien ve/edita producción
create policy adjop_sel on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos-op' and fn_puede('produccion','ver'));
create policy adjop_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos-op' and fn_puede('produccion','crear'));
create policy adjop_del on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos-op' and fn_puede('produccion','editar'));

-- cartelera: todo el equipo lee y sube (comunicación interna); borra el dueño
create policy cartelera_sel on storage.objects for select to authenticated
  using (bucket_id = 'cartelera');
create policy cartelera_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'cartelera' and owner = auth.uid());
create policy cartelera_del on storage.objects for delete to authenticated
  using (bucket_id = 'cartelera' and (owner = auth.uid() or fn_puede('nucleo','editar')));
