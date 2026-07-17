-- ============================================================
-- NUEVAS REFERENCIAS — platinas P076–P080 y apartado Impresión 3D
-- Acordado con Juan 17-jul-2026 tras cruzar BOM 2025 vs inventario:
--   · P023, P032, P068, P075 quedan RETIRADOS (no se reutilizan
--     mientras circule el Excel BOM 2025, para evitar confusiones).
--   · Cuñas en códigos consecutivos P076–P078 (regla de Juan:
--     platinas de un mismo producto van consecutivas).
--   · Tapas que antes eran platina ahora salen de impresora 3D →
--     nuevo tipo de material "Impresión 3D", códigos i3D001, i3D002.
-- Se crean con saldo 0: el conteo entra el lunes con el corte L/Mi/V.
-- Idempotente.
-- ============================================================

insert into tipos_material (nombre)
select 'Impresión 3D'
where not exists (select 1 from tipos_material where nombre = 'Impresión 3D');

do $$
declare
  v_plat smallint;
  v_i3d  smallint;
  v_und  smallint;
  r record;
begin
  select id into strict v_plat from tipos_material where nombre = 'Platinería';
  select id into strict v_i3d  from tipos_material where nombre = 'Impresión 3D';
  select id into strict v_und  from unidades_medida where clave = 'und';

  for r in
    select * from (values
      ('P076 · Platina cuña sencilla',                    'plat'),
      ('P077 · Platina cuña doble',                       'plat'),
      ('P078 · Platina pie amigo refuerzo cuñas',         'plat'),
      ('P079 · Platina pasamanos P20',                    'plat'),
      ('P080 · Platina almacenador banco a pared',        'plat'),
      ('i3D001 · Tapa columna 70×70 (impresión 3D)',      'i3d'),
      ('i3D002 · Tapa tubo redondo 48 mm (impresión 3D)', 'i3d')
    ) as t(nombre, grupo)
  loop
    insert into materiales (nombre, tipo_material_id, unidad_id,
                            costo_promedio, buffer_min, buffer_max)
    values (r.nombre, case when r.grupo = 'i3d' then v_i3d else v_plat end,
            v_und, 0, 0, 0)
    on conflict (nombre, tipo_material_id) do nothing;

    insert into existencias (material_id, tipo, cantidad_disponible, cantidad_reservada)
    select m.id, 'materia_prima', 0, 0
      from materiales m
     where m.nombre = r.nombre
    on conflict (material_id, tipo) do nothing;
  end loop;
end $$;

-- Verificación: debe devolver las 7 referencias nuevas en 0.
select m.nombre, t.nombre as tipo, e.cantidad_disponible
  from materiales m
  join tipos_material t on t.id = m.tipo_material_id
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.nombre like 'P07%' or m.nombre like 'P080%' or m.nombre like 'i3D%'
 order by m.nombre;
