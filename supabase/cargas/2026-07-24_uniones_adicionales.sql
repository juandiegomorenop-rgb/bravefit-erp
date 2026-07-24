-- ============================================================
-- UNIONES PERFORADAS ADICIONALES — Juan 24-jul-2026
-- ============================================================
-- Estas uniones estaban físicas pero NO entraron en el conteo del
-- 21-jul (que Juan confirma correcto). Por eso se SUMAN, no reemplazan.
--
--   0.5m  +8  → SE-UNP-050 (existe): 17 → 25
--   1.0m  +4  → SE-UNP-100 (NUEVA): se crea el SKU y se carga 4
--
-- Son subensambles YA fabricados: se cargan por 'ajuste' positivo, sin
-- backflush (sus platinas y tubo se gastaron hace tiempo). NO se usa el
-- botón de fabricar, que descontaría material otra vez.
--
-- FUERA a propósito (decisión de Juan): las medidas raras
-- 0.6m ×4, 2.05m ×2, 1.9m ×1 NO se crean como SKU (no son comunes). Se
-- manejan como corte especial en el estante — mismo criterio que las
-- columnas 2.4m/2.15m.  ⚠️ NOTA: la 0.6m sí apareció una vez (OP_0043,
-- Rack S7); si se vuelve frecuente, crear SE-UNP-060 luego.
--
-- Idempotente: la carga positiva se marca con una nota única y no se
-- repite si el script se corre dos veces.
-- ============================================================

-- 1 · Crear el SKU de la unión de 1m (si no existe), igual que fase 1.
insert into productos (sku, nombre, categoria_id, clasificacion, origen,
                       es_rack, es_subensamble, unidad_id, precio_lista, alto_cm)
select 'SE-UNP-100', 'Union perforada 1.0m', c.id, 'MTO', 'propio', false, true,
       (select id from unidades_medida where clave = 'und'), 0, null
  from categorias_producto c
 where c.clave = 'racks'
on conflict (sku) do nothing;

-- 2 · Sumar el stock adicional (una sola vez por la nota).
do $$
declare
  v_user uuid;
  v_ex   uuid;
  r record;
  c_nota constant text := 'Uniones adicionales no incluidas en el conteo del 21-jul (Juan 24-jul-2026)';
begin
  select id into strict v_user from usuarios where email = 'juanmoreno@bravefit.co';

  for r in
    select * from (values
      ('SE-UNP-050', 8),
      ('SE-UNP-100', 4)
    ) as t(sku, suma)
  loop
    -- existencia (nace en cero si es la primera vez)
    insert into existencias (producto_id, tipo, cantidad_disponible)
    select p.id, 'subensamble', 0 from productos p
     where p.sku = r.sku
       and not exists (select 1 from existencias e
                        where e.producto_id = p.id and e.tipo = 'subensamble');

    select e.id into v_ex
      from existencias e join productos p on p.id = e.producto_id
     where p.sku = r.sku and e.tipo = 'subensamble';

    -- guardia anti-doble-carga: si ya está esta nota, no repetir
    if v_ex is not null
       and not exists (select 1 from movimientos_inventario
                        where existencia_id = v_ex and nota = c_nota) then
      insert into movimientos_inventario (existencia_id, tipo, cantidad, usuario_id, nota)
      values (v_ex, 'ajuste', r.suma, v_user, c_nota);
    end if;
  end loop;
end $$;

-- Verificación: 0.5m debe quedar en 25 y 1.0m en 4.
select p.sku, p.nombre, e.cantidad_disponible
  from productos p
  join existencias e on e.producto_id = p.id and e.tipo = 'subensamble'
 where p.sku in ('SE-UNP-050','SE-UNP-100')
 order by p.sku;
