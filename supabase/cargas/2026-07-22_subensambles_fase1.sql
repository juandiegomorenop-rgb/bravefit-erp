-- ============================================================
-- SUBENSAMBLES · FASE 1 — categoría + catálogo + stock contado
-- ============================================================
-- Juan (22-jul-2026): columnas, uniones, barras y estructuras no son
-- MP (ya tienen trabajo de planta), ni PP (están terminadas), ni PT
-- (no se venden solas). Son SUBENSAMBLES.
--
-- Modelado: viven en `productos` con la marca `es_subensamble`, así
-- heredan gratis el BOM (producto_componentes) que necesitarán en la
-- Fase 2, las existencias y el kardex. El catálogo de VENTAS los
-- filtra para no ensuciarse.
--
-- SKU: prefijo `SE-` (fuera de la taxonomía 1-8 de líneas de venta,
-- porque un subensamble no es una línea comercial).
--
-- NOMENCLATURA acordada: "unión perforada" (nunca X Bean), "barra
-- desmontable" (nunca central abatible), medidas SIEMPRE en metros,
-- y "Estructura de X" cuando la pieza espera cojín para ser PT.
--
-- La COJINERÍA va como MATERIA PRIMA: llega tapizada del proveedor.
-- ============================================================

-- ---- 1. Marca de subensamble + tipo de existencia ----------
alter table productos
  add column if not exists es_subensamble boolean not null default false;

comment on column productos.es_subensamble is
  'true = pieza fabricada que se consume dentro de otro producto (columnas, uniones, barras, estructuras). No se vende suelta: el catálogo de Ventas la filtra.';

create index if not exists idx_productos_subensamble
  on productos (es_subensamble) where es_subensamble;

-- existencias: los productos podían ser 'terminado' o 'en_proceso'
alter table existencias drop constraint if exists existencias_check;
alter table existencias add constraint existencias_check
  check ((material_id is not null and producto_id is null and tipo = 'materia_prima')
      or (producto_id is not null and material_id is null
          and tipo in ('terminado','en_proceso','subensamble')));

alter table existencias drop constraint if exists existencias_tipo_check;
alter table existencias add constraint existencias_tipo_check
  check (tipo in ('terminado','materia_prima','en_proceso','subensamble'));

-- ---- 2. Catálogo de subensambles ---------------------------
-- unidad: 'und'. categoría: se reusa la de racks para que el módulo
-- pueda agrupar, pero lo que manda es es_subensamble.
insert into productos (sku, nombre, categoria_id, clasificacion, origen,
                       es_rack, es_subensamble, unidad_id, precio_lista, alto_cm)
select v.sku, v.nombre, c.id, 'MTO', 'propio', false, true,
       (select id from unidades_medida where clave = 'und'), 0, v.alto
from (values
  -- Columnas · el tipo de base es independiente de la altura
  ('SE-COL-200-NIV','Columna 70x70 · 2.0m · base niveladora',        200),
  ('SE-COL-220-NIV','Columna 70x70 · 2.2m · base niveladora',        220),
  ('SE-COL-230-BAS','Columna 70x70 · 2.3m · platina base',           230),
  ('SE-COL-270-BAS','Columna 70x70 · 2.7m · platina base',           270),
  -- Uniones perforadas (ex "X Bean" — nombre abolido)
  ('SE-UNP-040','Union perforada 0.4m',   null),
  ('SE-UNP-050','Union perforada 0.5m',   null),
  ('SE-UNP-150','Union perforada 1.5m',   null),
  -- Barras
  ('SE-BAR-100','Barra sencilla 1.0m',    null),
  ('SE-BAR-120','Barra sencilla 1.2m',    null),
  ('SE-BAR-150','Barra sencilla 1.5m',    null),
  ('SE-BAR-180','Barra sencilla 1.8m',    null),
  ('SE-BAR-200','Barra sencilla 2.0m',    null),
  ('SE-BAR-M','Barra tipo M',             null),
  ('SE-BAR-DESM','Barra desmontable',     null),
  -- Estructuras (esperan cojín para volverse PT)
  ('SE-EST-RACKPAD','Estructura de Rack Pad',           null),
  ('SE-EST-ROLLOAS','Estructura de rollos de asiento',  null),
  ('SE-EST-BANCOREC','Estructura de banco reclinable',  null)
) as v(sku, nombre, alto)
join categorias_producto c on c.clave = 'racks'
on conflict (sku) do nothing;

-- ---- 3. Cojinería como MATERIA PRIMA (llega del proveedor) --
insert into materiales (nombre, tipo_material_id, unidad_id, activo)
select v.nombre, tm.id, (select id from unidades_medida where clave='und'), true
from (values
  ('COJ001 · Cojin de banco plano'),
  ('COJ002 · Cojin de leg roller'),
  ('COJ003 · Cojin de rollo de asiento'),
  ('COJ004 · Cojin de banco reclinable (juego)'),
  ('COJ005 · Cojin de rack pad'),
  ('COJ006 · Cojin Dap Bar / Estacion de fondos ABS'),
  ('COJ007 · Cojin apoya brazos Dap Bar / Estacion de fondos ABS'),
  ('COJ008 · Cojin 38x44')
) as v(nombre)
join tipos_material tm on tm.nombre = 'Cojinería'
where not exists (select 1 from materiales m where m.nombre = v.nombre);

-- ---- 4. Existencias en cero + ajuste al conteo del 21-jul ---
do $$
declare v_user uuid; v_ex uuid; v_delta numeric; r record;
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  -- 4a · SUBENSAMBLES
  for r in
    select * from (values
      ('SE-COL-200-NIV',  2), ('SE-COL-220-NIV', 23),
      ('SE-COL-230-BAS',  6), ('SE-COL-270-BAS',  6),
      ('SE-UNP-040',      4), ('SE-UNP-050',     17), ('SE-UNP-150', 12),
      ('SE-BAR-100',     18), ('SE-BAR-120',      4), ('SE-BAR-150',  2),
      ('SE-BAR-180',      1), ('SE-BAR-200',    104),
      ('SE-BAR-M',        7), ('SE-BAR-DESM',     3),
      ('SE-EST-RACKPAD',  1), ('SE-EST-ROLLOAS',  4), ('SE-EST-BANCOREC', 9)
    ) as t(sku, cant)
  loop
    insert into existencias (producto_id, tipo, cantidad_disponible)
    select p.id, 'subensamble', 0 from productos p
     where p.sku = r.sku
       and not exists (select 1 from existencias e
                        where e.producto_id = p.id and e.tipo = 'subensamble');

    select e.id, r.cant - e.cantidad_disponible into v_ex, v_delta
      from existencias e join productos p on p.id = e.producto_id
     where p.sku = r.sku and e.tipo = 'subensamble';

    if v_ex is not null and v_delta <> 0 then
      insert into movimientos_inventario (existencia_id, tipo, cantidad, usuario_id, nota)
      values (v_ex, 'ajuste', v_delta, v_user,
              'Conteo fisico 21-jul-2026 · carga inicial de subensambles');
    end if;
  end loop;

  -- 4b · COJINERÍA (materia prima)
  for r in
    select * from (values
      ('COJ001 · Cojin de banco plano',                                  1),
      ('COJ002 · Cojin de leg roller',                                   4),
      ('COJ003 · Cojin de rollo de asiento',                             8),
      ('COJ004 · Cojin de banco reclinable (juego)',                     9),
      ('COJ005 · Cojin de rack pad',                                     4),
      ('COJ006 · Cojin Dap Bar / Estacion de fondos ABS',                2),
      ('COJ007 · Cojin apoya brazos Dap Bar / Estacion de fondos ABS',   2),
      ('COJ008 · Cojin 38x44',                                           2)
    ) as t(nombre, cant)
  loop
    insert into existencias (material_id, tipo, cantidad_disponible)
    select m.id, 'materia_prima', 0 from materiales m
     where m.nombre = r.nombre
       and not exists (select 1 from existencias e
                        where e.material_id = m.id and e.tipo = 'materia_prima');

    select e.id, r.cant - e.cantidad_disponible into v_ex, v_delta
      from existencias e join materiales m on m.id = e.material_id
     where m.nombre = r.nombre and e.tipo = 'materia_prima';

    if v_ex is not null and v_delta <> 0 then
      insert into movimientos_inventario (existencia_id, tipo, cantidad, usuario_id, nota)
      values (v_ex, 'ajuste', v_delta, v_user,
              'Conteo fisico 21-jul-2026 · cojineria (llega tapizada del proveedor)');
    end if;
  end loop;
end $$;

-- ---- 5. Nota de la excepción del banco reclinable ----------
comment on column existencias.cantidad_disponible is
  'Saldo derivado del kardex. NOTA 22-jul: las 9 estructuras de banco reclinable incluyen 8 que estaban en fabricacion (listas en ~2 dias) — decision de Juan para tenerlas ya visibles en inventario.';

-- Verificación 1: subensambles con su stock.
select p.sku, p.nombre, e.cantidad_disponible
  from productos p
  join existencias e on e.producto_id = p.id and e.tipo = 'subensamble'
 where p.es_subensamble
 order by p.sku;

-- Verificación 2: cojinería (MP).
select m.nombre, e.cantidad_disponible
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre like 'COJ%'
 order by m.nombre;

-- Verificación 3: juegos incompletos (estructura vs cojín).
select 'Rack Pad' as juego,
       (select cantidad_disponible from existencias e join productos p on p.id=e.producto_id where p.sku='SE-EST-RACKPAD') as estructuras,
       (select cantidad_disponible from existencias e join materiales m on m.id=e.material_id where m.nombre like 'COJ005%') as cojines
union all
select 'Rollo de asiento',
       (select cantidad_disponible from existencias e join productos p on p.id=e.producto_id where p.sku='SE-EST-ROLLOAS'),
       (select cantidad_disponible from existencias e join materiales m on m.id=e.material_id where m.nombre like 'COJ003%')
union all
select 'Banco reclinable',
       (select cantidad_disponible from existencias e join productos p on p.id=e.producto_id where p.sku='SE-EST-BANCOREC'),
       (select cantidad_disponible from existencias e join materiales m on m.id=e.material_id where m.nombre like 'COJ004%');
