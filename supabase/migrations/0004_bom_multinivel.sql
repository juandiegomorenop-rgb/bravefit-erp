-- ============================================================
-- 0004 · BOM MULTINIVEL — una línea del despiece puede apuntar a un
--        SUBENSAMBLE en vez de a un material.
-- ============================================================
-- Hoy el BOM es de UN nivel: producto → platina. Eso obliga a que el
-- rack declare las platinas de sus columnas, cuando la columna ya se
-- fabricó antes y sus platinas ya se gastaron. De ahí el doble conteo.
--
-- Con esta columna el despiece queda en dos niveles:
--     Banco reclinable → estructura de banco (subensamble) + cojín
--     Estructura de banco → platinas + tubo
--
-- 🔒 DOBLE CANDADO (importante, es lo que hace segura la migración):
-- `fn_descontar_bom` filtra `pc.material_id is not null`. Una línea que
-- apunta a un subensamble tiene material_id NULL, así que el descuento
-- automático de Corte la IGNORA sin tocar una sola línea de código.
-- Eso permite migrar producto por producto: el que ya tiene su BOM en
-- dos niveles deja de descontar platinas a ciegas; el que no, sigue
-- como estaba. Modo mixto como característica, no como riesgo.
--
-- ⚠️ AL MIGRAR UN PRODUCTO hay que BORRAR sus líneas de platina en el
-- MISMO script en que se agrega la línea del subensamble. Si quedan las
-- dos, el producto descuenta DOS VECES. (Es el mismo mecanismo que
-- produjo el doble conteo del banco reclinable en julio.)
--
-- Esta migración NO cambia ningún comportamiento: solo habilita.
-- Idempotente.
-- ============================================================

alter table producto_componentes
  add column if not exists componente_producto_id uuid references productos(id);

comment on column producto_componentes.componente_producto_id is
  'Subensamble que consume esta línea (excluyente con material_id). '
  'fn_descontar_bom la ignora a propósito: el subensamble se consume por '
  'su propio camino, no explotando sus platinas dentro del producto padre.';

do $$
begin
  -- Una línea es de material, o de subensamble, o descriptiva. Nunca dos.
  if not exists (
    select 1 from pg_constraint where conname = 'pc_fuente_excluyente'
  ) then
    alter table producto_componentes
      add constraint pc_fuente_excluyente
      check (material_id is null or componente_producto_id is null);
  end if;

  -- Un producto no puede contenerse a sí mismo.
  if not exists (
    select 1 from pg_constraint where conname = 'pc_sin_autoreferencia'
  ) then
    alter table producto_componentes
      add constraint pc_sin_autoreferencia
      check (componente_producto_id is distinct from producto_id);
  end if;
end $$;

create index if not exists idx_bom_componente
  on producto_componentes (componente_producto_id)
  where componente_producto_id is not null;

-- Verificación: la columna existe y hoy nadie la usa todavía (0 filas).
select count(*) filter (where componente_producto_id is not null) as lineas_de_subensamble,
       count(*) filter (where material_id is not null)            as lineas_de_material,
       count(*) filter (where material_id is null
                          and componente_producto_id is null)     as lineas_descriptivas
  from producto_componentes;
