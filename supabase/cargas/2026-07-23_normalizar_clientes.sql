-- ============================================================
-- NORMALIZAR LA BASE DE CLIENTES EXISTENTE (pedido de Juan 23-jul)
-- Capitaliza nombres/razón social y pone puntos a cédulas/NIT, con la
-- misma lógica de los helpers del ERP (capitalizarNombre / formatearDocumento).
--
-- USO: correr PRIMERO el bloque 1 (funciones + PREVIEW) y revisar la
-- tabla de "antes → después". Si está bien, correr el bloque 2 (APLICAR).
-- Solo toca `nombre` y `nit_cedula` de clientes activos que cambien.
-- No toca direcciones, correos, ciudades ni nada más.
-- ============================================================

-- ============ BLOQUE 1 · funciones + PREVIEW ============

-- Capitaliza: primera de cada palabra en mayúscula, resto minúscula.
-- Preserva siglas societarias (SAS, Ltda…) y con puntos (S.A.S, que
-- initcap ya deja bien). Word boundary \y = palabra completa.
create or replace function bf_capitalizar(txt text) returns text
language plpgsql immutable as $$
declare v text;
begin
  if btrim(coalesce(txt,'')) = '' then return txt; end if;
  v := initcap(lower(btrim(regexp_replace(txt, '\s+', ' ', 'g'))));
  v := regexp_replace(v, '\ySas\y',  'SAS',  'g');
  v := regexp_replace(v, '\yLtda\y', 'LTDA', 'g');
  v := regexp_replace(v, '\ySaa\y',  'SAA',  'g');
  v := regexp_replace(v, '\ySca\y',  'SCA',  'g');
  v := regexp_replace(v, '\ySenc\y', 'SENC', 'g');
  v := regexp_replace(v, '\ySas\.\y','S.A.S','g');
  v := regexp_replace(v, '\yEu\y',   'EU',   'g');
  return v;
end $$;

-- Formatea cédula/NIT: puntos de miles + conserva el dígito de
-- verificación si viene tras guion ("900748071-5" → "900.748.071-5").
create or replace function bf_formatear_doc(doc text) returns text
language plpgsql immutable as $$
declare v text := btrim(coalesce(doc,'')); v_dv text; v_base text; m text[];
begin
  if v = '' then return doc; end if;
  m := regexp_match(v, '^(.+)-\s*([0-9])\s*$');   -- <número> - <dv>
  if m is not null then
    v_base := regexp_replace(m[1], '[^0-9]', '', 'g');
    v_dv   := m[2];
  else
    v_base := regexp_replace(v, '[^0-9]', '', 'g');
    v_dv   := null;
  end if;
  if v_base = '' then return doc; end if;
  v_base := regexp_replace(v_base, '(\d)(?=(\d{3})+$)', '\1.', 'g');
  return case when v_dv is null then v_base else v_base||'-'||v_dv end;
end $$;

-- PREVIEW: qué clientes cambiarían (revisar antes de aplicar).
select id, tipo,
       nombre                    as nombre_actual,
       bf_capitalizar(nombre)    as nombre_nuevo,
       nit_cedula                as doc_actual,
       bf_formatear_doc(nit_cedula) as doc_nuevo
  from clientes
 where activo
   and (nombre     is distinct from bf_capitalizar(nombre)
     or nit_cedula is distinct from bf_formatear_doc(nit_cedula))
 order by nombre;


-- ============ BLOQUE 2 · APLICAR (correr tras revisar el preview) ============
/*
update clientes
   set nombre     = bf_capitalizar(nombre),
       nit_cedula = bf_formatear_doc(nit_cedula)
 where activo
   and (nombre     is distinct from bf_capitalizar(nombre)
     or nit_cedula is distinct from bf_formatear_doc(nit_cedula));

-- Verificación: no debería quedar nada por normalizar.
select count(*) as pendientes
  from clientes
 where activo
   and (nombre     is distinct from bf_capitalizar(nombre)
     or nit_cedula is distinct from bf_formatear_doc(nit_cedula));

-- Limpieza de las funciones auxiliares (ya cumplieron su función).
drop function if exists bf_capitalizar(text);
drop function if exists bf_formatear_doc(text);
*/
