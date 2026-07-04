-- ============================================================
-- ERP BRAVEFIT · Migración 0002 · Row Level Security
-- La autorización vive en la BD: aunque la app tuviera un bug,
-- Postgres niega lo que el rol no permite.
-- El navegador SIEMPRE entra como `authenticated` (anon key + JWT).
-- Los workers/webhooks usan service_role (bypassa RLS, solo servidor).
-- ============================================================

-- ------------------------------------------------------------
-- Funciones de apoyo (security definer para leer usuarios/permisos)
-- ------------------------------------------------------------

create or replace function fn_mi_rol_id() returns smallint
language sql stable security definer set search_path = public as $$
  select rol_id from usuarios where id = auth.uid() and activo
$$;

create or replace function fn_mi_empleado_id() returns uuid
language sql stable security definer set search_path = public as $$
  select empleado_id from usuarios where id = auth.uid() and activo
$$;

create or replace function fn_puede(p_modulo text, p_accion text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p_accion
             when 'ver'     then p.puede_ver
             when 'crear'   then p.puede_crear
             when 'editar'  then p.puede_editar
             when 'aprobar' then p.puede_aprobar
           end
      from permisos p
     where p.rol_id = fn_mi_rol_id() and p.modulo = p_modulo
  ), false)
$$;

-- ------------------------------------------------------------
-- Activar RLS en TODAS las tablas
-- ------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Núcleo
-- ------------------------------------------------------------

-- usuarios: cada quien ve su fila; Admin (nucleo) ve y administra todas
create policy usuarios_sel on usuarios for select to authenticated
  using (id = auth.uid() or fn_puede('nucleo','ver'));
create policy usuarios_ins on usuarios for insert to authenticated
  with check (fn_puede('nucleo','crear'));
create policy usuarios_upd on usuarios for update to authenticated
  using (fn_puede('nucleo','editar')) with check (fn_puede('nucleo','editar'));

-- roles/permisos: todos leen (la navegación se arma con esto); solo Admin escribe
create policy roles_sel on roles for select to authenticated using (true);
create policy roles_mod on roles for all to authenticated
  using (fn_puede('nucleo','editar')) with check (fn_puede('nucleo','editar'));
create policy permisos_sel on permisos for select to authenticated using (true);
create policy permisos_mod on permisos for all to authenticated
  using (fn_puede('nucleo','editar')) with check (fn_puede('nucleo','editar'));

-- auditoría: solo Admin consulta; escribe el trigger (security definer)
create policy auditoria_sel on auditoria for select to authenticated
  using (fn_puede('nucleo','ver'));

-- ------------------------------------------------------------
-- Catálogos parametrizables: todos leen; edita quien tenga 'configuracion'
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ciudades','festivos','unidades_medida','categorias_producto','etapas_crm',
    'estados_cotizacion','etapas_produccion','origenes_op','tipos_material',
    'conceptos_pyg','recargos','secuencias'
  ] loop
    execute format($p$create policy %1$s_sel on %1$s for select to authenticated using (true)$p$, t);
    execute format($p$create policy %1$s_mod on %1$s for all to authenticated
      using (fn_puede('configuracion','editar'))
      with check (fn_puede('configuracion','editar'))$p$, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- Plantilla por módulo: ver / crear / editar
-- (el DELETE físico no se otorga a nadie: borrado lógico vía update)
-- ------------------------------------------------------------
create or replace procedure pr_politicas_modulo(p_tabla text, p_modulo text)
language plpgsql as $$
begin
  execute format($p$create policy %1$s_sel on %1$s for select to authenticated
    using (fn_puede(%2$L,'ver'))$p$, p_tabla, p_modulo);
  execute format($p$create policy %1$s_ins on %1$s for insert to authenticated
    with check (fn_puede(%2$L,'crear'))$p$, p_tabla, p_modulo);
  execute format($p$create policy %1$s_upd on %1$s for update to authenticated
    using (fn_puede(%2$L,'editar')) with check (fn_puede(%2$L,'editar'))$p$, p_tabla, p_modulo);
end $$;

-- Ventas (solo Admin en el seed inicial)
call pr_politicas_modulo('cotizaciones',            'ventas');
call pr_politicas_modulo('cotizacion_items',        'ventas');
call pr_politicas_modulo('oportunidades',           'ventas');
call pr_politicas_modulo('pedidos_web',             'ventas');
call pr_politicas_modulo('shopify_metricas_diarias','ventas');
call pr_politicas_modulo('catalogos',               'ventas');
call pr_politicas_modulo('catalogo_productos',      'ventas');

-- Producción y Logística
call pr_politicas_modulo('ordenes_pedido',          'produccion');
call pr_politicas_modulo('op_items',                'produccion');
call pr_politicas_modulo('op_historial_etapas',     'produccion');
call pr_politicas_modulo('op_observaciones',        'produccion');
call pr_politicas_modulo('solicitudes_compra',      'produccion');
call pr_politicas_modulo('sc_items',                'produccion');
call pr_politicas_modulo('recepciones',             'produccion');
call pr_politicas_modulo('recepcion_items',         'produccion');
call pr_politicas_modulo('garantias',               'produccion');
call pr_politicas_modulo('materiales',              'produccion');
call pr_politicas_modulo('proveedores',             'produccion');
call pr_politicas_modulo('producto_componentes',    'produccion');  -- BOM lo usa planta

-- Inventario: los SALDOS los mantiene solo el trigger del kardex (security
-- definer) — ningún usuario tiene UPDATE directo sobre existencias, y el
-- kardex y los despachos son inmutables (sin política de update/delete).
create policy existencias_sel on existencias for select to authenticated
  using (fn_puede('produccion','ver'));
create policy existencias_ins on existencias for insert to authenticated
  with check (fn_puede('produccion','crear'));
create policy movinv_sel on movimientos_inventario for select to authenticated
  using (fn_puede('produccion','ver'));
create policy movinv_ins on movimientos_inventario for insert to authenticated
  with check (fn_puede('produccion','crear'));
create policy despachos_sel on op_despachos for select to authenticated
  using (fn_puede('produccion','ver'));
create policy despachos_ins on op_despachos for insert to authenticated
  with check (fn_puede('produccion','crear'));

-- Mercadeo
call pr_politicas_modulo('campanas',           'mercadeo');
call pr_politicas_modulo('campana_metricas',   'mercadeo');
call pr_politicas_modulo('encuestas',          'mercadeo');
call pr_politicas_modulo('encuesta_respuestas','mercadeo');
call pr_politicas_modulo('redes_metricas',     'mercadeo');

-- Finanzas (PyG manual y nivel de servicio)
call pr_politicas_modulo('pyg_mensual',            'finanzas');
call pr_politicas_modulo('nivel_servicio_mensual', 'finanzas');

-- RRHH administrativo
call pr_politicas_modulo('vacantes',     'rrhh');
call pr_politicas_modulo('aplicaciones', 'rrhh');
call pr_politicas_modulo('nominas',      'rrhh_nomina');  -- solo Admin (queda en Siigo)

-- ------------------------------------------------------------
-- Casos compartidos entre módulos
-- ------------------------------------------------------------

-- clientes y productos: los ve quien tenga ventas O producción
create policy clientes_sel on clientes for select to authenticated
  using (fn_puede('ventas','ver') or fn_puede('produccion','ver'));
create policy clientes_ins on clientes for insert to authenticated
  with check (fn_puede('ventas','crear') or fn_puede('produccion','crear'));
create policy clientes_upd on clientes for update to authenticated
  using (fn_puede('ventas','editar')) with check (fn_puede('ventas','editar'));

create policy productos_sel on productos for select to authenticated
  using (fn_puede('ventas','ver') or fn_puede('produccion','ver'));
create policy productos_mod on productos for insert to authenticated
  with check (fn_puede('ventas','crear'));
create policy productos_upd on productos for update to authenticated
  using (fn_puede('ventas','editar')) with check (fn_puede('ventas','editar'));

create policy prod_dim_sel on producto_dimensiones for select to authenticated
  using (fn_puede('ventas','ver') or fn_puede('produccion','ver'));
create policy prod_dim_mod on producto_dimensiones for all to authenticated
  using (fn_puede('ventas','editar')) with check (fn_puede('ventas','editar'));

-- facturas: las lee ventas Y producción (garantías muestran # factura);
-- las escribe el worker de Siigo (service_role) o quien edite ventas
create policy facturas_sel on facturas for select to authenticated
  using (fn_puede('ventas','ver') or fn_puede('produccion','ver'));
create policy facturas_ins on facturas for insert to authenticated
  with check (fn_puede('ventas','editar'));
create policy facturas_upd on facturas for update to authenticated
  using (fn_puede('ventas','editar')) with check (fn_puede('ventas','editar'));

-- ------------------------------------------------------------
-- RRHH con alcance fino (la diferencia Ops1 vs Ops2)
-- ------------------------------------------------------------

-- empleados: Admin todo; los demás su propia ficha; Ops1 además fichas
-- BÁSICAS de técnicos (columnas sensibles se ocultan por campos_ocultos en la API)
create policy empleados_sel on empleados for select to authenticated
  using (
    fn_puede('rrhh','ver')
    or id = fn_mi_empleado_id()
    or (fn_puede('rrhh_vacaciones_tecnicos','ver') and es_tecnico)
    or (fn_puede('rrhh_evaluaciones_tecnicos','ver') and es_tecnico)
  );
create policy empleados_mod on empleados for insert to authenticated
  with check (fn_puede('rrhh','crear'));
create policy empleados_upd on empleados for update to authenticated
  using (fn_puede('rrhh','editar')) with check (fn_puede('rrhh','editar'));

-- vacaciones: propias siempre · técnicos si el rol lo tiene · Admin todas
create policy vacaciones_sel on vacaciones for select to authenticated
  using (
    fn_puede('rrhh','ver')
    or empleado_id = fn_mi_empleado_id()
    or (fn_puede('rrhh_vacaciones_tecnicos','ver')
        and exists (select 1 from empleados e where e.id = empleado_id and e.es_tecnico))
  );
create policy vacaciones_ins on vacaciones for insert to authenticated
  with check (empleado_id = fn_mi_empleado_id() or fn_puede('rrhh','crear'));
-- aprobar/editar: SOLO quien tenga aprobar en rrhh (Admin)
create policy vacaciones_upd on vacaciones for update to authenticated
  using (fn_puede('rrhh','aprobar')) with check (fn_puede('rrhh','aprobar'));

-- evaluaciones: propias · técnicos si el rol lo tiene · Admin todas
create policy evaluaciones_sel on evaluaciones for select to authenticated
  using (
    fn_puede('rrhh','ver')
    or empleado_id = fn_mi_empleado_id()
    or (fn_puede('rrhh_evaluaciones_tecnicos','ver')
        and exists (select 1 from empleados e where e.id = empleado_id and e.es_tecnico))
  );
create policy evaluaciones_mod on evaluaciones for insert to authenticated
  with check (fn_puede('rrhh','crear'));
create policy evaluaciones_upd on evaluaciones for update to authenticated
  using (fn_puede('rrhh','editar')) with check (fn_puede('rrhh','editar'));

-- ------------------------------------------------------------
-- Cartelera: todos ven y publican; cada quien edita lo suyo; Admin modera
-- ------------------------------------------------------------
create policy publicaciones_sel on publicaciones for select to authenticated using (true);
create policy publicaciones_ins on publicaciones for insert to authenticated
  with check (autor_id = auth.uid());
create policy publicaciones_upd on publicaciones for update to authenticated
  using (autor_id = auth.uid() or fn_puede('nucleo','editar'))
  with check (autor_id = auth.uid() or fn_puede('nucleo','editar'));

create policy reacciones_sel on publicacion_reacciones for select to authenticated using (true);
create policy reacciones_ins on publicacion_reacciones for insert to authenticated
  with check (usuario_id = auth.uid());
create policy reacciones_del on publicacion_reacciones for delete to authenticated
  using (usuario_id = auth.uid());

create policy eventos_sel on eventos for select to authenticated using (true);
create policy eventos_mod on eventos for all to authenticated
  using (fn_puede('nucleo','editar')) with check (fn_puede('nucleo','editar'));

-- ------------------------------------------------------------
-- Chat Claude: cada usuario solo SU conversación
-- ------------------------------------------------------------
create policy chatconv_all on chat_conversaciones for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy chatmsg_all on chat_mensajes for all to authenticated
  using (exists (select 1 from chat_conversaciones c
                  where c.id = conversacion_id and c.usuario_id = auth.uid()))
  with check (exists (select 1 from chat_conversaciones c
                  where c.id = conversacion_id and c.usuario_id = auth.uid()));

-- ------------------------------------------------------------
-- integracion_eventos: SIN política para authenticated
-- → solo service_role (workers del servidor) puede tocarla.
-- ------------------------------------------------------------
