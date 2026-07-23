-- ============================================================
-- RECETAS DE LOS 3 SUBENSAMBLES DEL RACK PF5 FIJO (piloto)
-- Dictadas por Juan · cargadas 23-jul-2026
-- ============================================================
--   SE-COL-220-NIV  Columna 70x70 · 2.2m · base niveladora
--   SE-UNP-050      Unión perforada 0.5m
--   SE-BAR-100      Barra sencilla 1.0m
--
-- ⚠️ ESTE SCRIPT NO CAMBIA NINGÚN COMPORTAMIENTO. Carga las recetas de
-- los subensambles, que hoy NADIE explota: `fn_descontar_bom` solo mira
-- el BOM del producto de la OP, no baja un nivel más. El BOM del rack
-- PF5 sigue plano y sigue descontando platinas igual que ayer.
-- La migración del rack va en OTRO script, cuando exista el consumo.
--
-- FUERA DE LAS RECETAS, por decisión de Juan (23-jul):
--   · NIVELADOR ½" = CONSUMIBLE. "Se pone al final solo al empacar el
--     pedido". No entra al BOM. (Tampoco estaba en el BOM plano, así
--     que dejarlo fuera mantiene la migración exactamente neutra.)
--   · Tornillería, chazos, electrodo, disco, pintura y remaches siguen
--     igual: se compran por mínimo y se cuentan una vez al mes.
--
-- ✅ VERIFICACIÓN DE EQUIVALENCIA (la razón por la que estas recetas
-- son seguras). Explotando el PF5 Fijo con ellas:
--     2 columnas → P014 ×2  + i3D001 ×2
--     4 uniones  → P005 ×8
--     1 barra    → P002 ×2
-- El BOM plano de hoy dice exactamente P014×2, P005×8, P002×2, i3D001×2.
-- Cuadra al 100%, sin sobrantes ni faltantes. Lo nuevo que aportan es el
-- TUBO, que nunca estuvo cargado: 6.4m de 70×70 + 1m de redondo Ø33.
--
-- Idempotente: borra y recarga las líneas de estos 3 subensambles.
-- ============================================================

do $$
declare
  v_prod  uuid;
  v_mat   uuid;
  v_falta text := '';
  r record;
begin
  for r in
    select * from (values
      -- subensamble,        código material, categoría,          descripción,                       cantidad
      ('SE-COL-220-NIV', 'P014',   'columna',          'Platina nivelador',                   1),
      ('SE-COL-220-NIV', 'i3D001', 'columna',          'Tapa de columna',                     1),
      ('SE-COL-220-NIV', 'TUB70',  'columna',          'Tubo PTS 70x70 (2.2 m)',            2.2),

      ('SE-UNP-050',     'P005',   'union_perforada',  'Platina de union perforada',          2),
      ('SE-UNP-050',     'TUB70',  'union_perforada',  'Tubo PTS 70x70 (0.5 m)',            0.5),

      ('SE-BAR-100',     'P002',   'barra',            'Platina barra sencilla',              2),
      ('SE-BAR-100',     'TUBR33', 'barra',            'Tuberia redonda D33 (1.0 m)',         1)
    ) as t(sku, codigo, categoria, descripcion, cantidad)
  loop
    select id into v_prod from productos where sku = r.sku;
    if v_prod is null then
      v_falta := v_falta || r.sku || ' ';
      continue;
    end if;

    -- match por CÓDIGO al inicio del nombre: sobrevive a renombres
    select id into v_mat from materiales where nombre like r.codigo || ' ·%';
    if v_mat is null then
      v_falta := v_falta || r.codigo || ' ';
      continue;
    end if;

    -- idempotencia: una línea por (subensamble, material)
    delete from producto_componentes
     where producto_id = v_prod and material_id = v_mat;

    insert into producto_componentes
      (producto_id, material_id, categoria, descripcion, cantidad, visible_cliente)
    values
      (v_prod, v_mat, r.categoria, r.descripcion, r.cantidad, false);
  end loop;

  if v_falta <> '' then
    raise notice 'ATENCIÓN — no encontrados (líneas omitidas): %', v_falta;
  end if;
end $$;

-- Verificación 1: las recetas cargadas.
select p.sku as subensamble, m.nombre as componente, pc.cantidad
  from producto_componentes pc
  join productos  p on p.id = pc.producto_id
  join materiales m on m.id = pc.material_id
 where p.sku in ('SE-COL-220-NIV','SE-UNP-050','SE-BAR-100')
 order by p.sku, m.nombre;

-- Verificación 2: la explosión del PF5 Fijo con estas recetas debe dar
-- lo MISMO que su BOM plano de hoy (P014 2, P005 8, P002 2, i3D001 2).
select m.nombre as componente,
       sum(sub.cantidad * v.veces) as explotado
  from (values ('SE-COL-220-NIV', 2), ('SE-UNP-050', 4), ('SE-BAR-100', 1))
         as v(sku, veces)
  join productos p on p.sku = v.sku
  join producto_componentes sub on sub.producto_id = p.id
  join materiales m on m.id = sub.material_id
 group by m.nombre
 order by m.nombre;
