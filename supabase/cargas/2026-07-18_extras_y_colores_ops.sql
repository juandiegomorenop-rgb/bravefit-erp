-- ============================================================
-- OPs BACKLOG: comercializados como LÍNEAS (con foto en el formato)
-- + COLORES por ítem (Negro por defecto en propios; 4 excepciones)
-- Decisiones de Juan 18-jul-2026:
--   · "agarre espalda" = 3AgPulUp (amplio/pull up)
--   · David Freyre: piso Sponch ×9 m²
--   · Juan Pablo: mancuernas ×2 de 5–25kg (30/35/45 NO están en el
--     maestro → quedan en notas hasta que Juan las cree)
--   · Natali: barra cromada 15kg; discos en kg quedan en notas
--   · Colores: Fidel PF5 columnas gris claro · Julián DC Bar piezas
--     rojas · Juan Pablo uniones+jlocks+landmine amarillo vivo ·
--     Leonardo PF5p columnas doradas · resto Negro
-- Idempotente (guardia sobre extras ya cargados).
-- ============================================================

-- Paleta: colores especiales pedidos en estas OPs
insert into colores (nombre, hex)
select v.n, v.h from (values
  ('Gris claro','#C9CBCD'), ('Amarillo vivo','#FFD400'), ('Dorado','#C9A227')
) v(n,h)
where not exists (select 1 from colores c where c.nombre = v.n);

do $$
declare v_guard int;
begin
  select count(*) into v_guard
    from op_items oi
    join ordenes_pedido o on o.id = oi.op_id
    join productos p on p.id = oi.producto_id
   where o.numero = 'OP_WA_0007' and p.sku = '6DiBum35lb';
  if v_guard > 0 then
    raise notice 'Los extras ya estaban cargados; no se repiten.';
    return;
  end if;

  insert into op_items (op_id, producto_id, cantidad, precio_unit)
  select o.id, p.id, x.cant, p.precio_lista
  from (values
    -- 0001 David Freyre
    ('OP_WA_0001','3AgTob',1), ('OP_WA_0001','3AgPulUp',1),
    ('OP_WA_0001','3AgLazo',1), ('OP_WA_0001','8PisCauSpon',9),
    -- 0002 Diana Gómez (+ alm discos pared 3N que era propio y estaba en notas)
    ('OP_WA_0002','3AgLazo',1), ('OP_WA_0002','3AgTob',1),
    ('OP_WA_0002','3AgIndivid',1), ('OP_WA_0002','3AgPulUp',1),
    ('OP_WA_0002','8aldipa3',1),
    -- 0006 Habitare
    ('OP_WA_0006','6DiEnc5lb',1), ('OP_WA_0006','6DiBum10lb',2),
    ('OP_WA_0006','6DiBum15lb',2), ('OP_WA_0006','6DiBum25lb',2),
    ('OP_WA_0006','6DiBum35lb',2), ('OP_WA_0006','6DiBum45lb',2),
    -- 0007 Héctor Acosta
    ('OP_WA_0007','6DiBum35lb',2), ('OP_WA_0007','6DiBum45lb',2),
    -- 0008 Juan Carlos Rodríguez
    ('OP_WA_0008','6BaOlCro15kg',1), ('OP_WA_0008','6DiBum15lb',2),
    ('OP_WA_0008','6DiBum25lb',2), ('OP_WA_0008','6DiBum45lb',2),
    ('OP_WA_0008','3AgPulUp',1), ('OP_WA_0008','3AgLazo',1),
    ('OP_WA_0008','3AgIndivid',1), ('OP_WA_0008','8PisCauSpon',7),
    -- 0009 Juan Pablo Valbuena
    ('OP_WA_0009','6BaOlNeg15kg',1), ('OP_WA_0009','6BaOlNeg20kg',1),
    ('OP_WA_0009','3AgPulUp',1), ('OP_WA_0009','3AgIndivid',1),
    ('OP_WA_0009','3AgTob',1), ('OP_WA_0009','3AgLazo',1),
    ('OP_WA_0009','6MaHex5kg',2), ('OP_WA_0009','6MaHex7.5kg',2),
    ('OP_WA_0009','6MaHex10kg',2), ('OP_WA_0009','6MaHex12.5kg',2),
    ('OP_WA_0009','6MaHex15kg',2), ('OP_WA_0009','6MaHex17.5kg',2),
    ('OP_WA_0009','6MaHex20kg',2), ('OP_WA_0009','6MaHex25kg',2),
    -- 0011 Kevin Criollo
    ('OP_WA_0011','6BaOlNeg15kg',1), ('OP_WA_0011','6DiBum10lb',4),
    ('OP_WA_0011','6DiBum15lb',4), ('OP_WA_0011','3AgIndivid',1),
    ('OP_WA_0011','3AgTob',1), ('OP_WA_0011','3AgPulUp',1),
    ('OP_WA_0011','3AgLazo',1),
    -- 0014 Natali Uribe
    ('OP_WA_0014','6BaOlCro15kg',1),
    -- 0015 Sebastián Pérez
    ('OP_WA_0015','6BaOlNeg20kg',1), ('OP_WA_0015','6DiBum15lb',2),
    ('OP_WA_0015','6DiBum25lb',2), ('OP_WA_0015','6DiBum35lb',2)
  ) x(numero, sku, cant)
  join ordenes_pedido o on o.numero = x.numero
  join productos p on p.sku = x.sku;
end $$;

-- Color NEGRO por defecto en todo ítem PROPIO sin color
update op_items oi set color = 'Negro'
from ordenes_pedido o, productos p
where o.id = oi.op_id and p.id = oi.producto_id
  and o.numero like 'OP\_WA\_%' and p.origen = 'propio' and oi.color is null;

-- Excepciones de color (resaltan en el formato con su chip pintado)
update op_items oi set color = 'Gris claro'
from ordenes_pedido o, productos p
where o.id = oi.op_id and p.id = oi.producto_id
  and o.numero = 'OP_WA_0005' and p.sku = '1RaPF5f';

update op_items oi set color = 'Rojo'
from ordenes_pedido o, productos p
where o.id = oi.op_id and p.id = oi.producto_id
  and o.numero = 'OP_WA_0010' and p.sku = '7DcBar';

update op_items oi set color = 'Amarillo vivo'
from ordenes_pedido o, productos p
where o.id = oi.op_id and p.id = oi.producto_id
  and o.numero = 'OP_WA_0009' and p.sku in ('1RaS15','3Land');

update op_items oi set color = 'Dorado'
from ordenes_pedido o, productos p
where o.id = oi.op_id and p.id = oi.producto_id
  and o.numero = 'OP_WA_0012' and p.sku = '1RaPF5p';

-- Notas: fuera lo que ya es línea; quedan alcance de colores y pendientes
update ordenes_pedido set notas = 'Mueble mixto 0.9×1.5×0.45m y almacenador de fitball PENDIENTES de crear en catálogo maestro. CON INSTALACION Y ENVIO. Vendedor Yohan S.' where numero = 'OP_WA_0001';
update ordenes_pedido set notas = 'Kit bandas de poder PENDIENTE de crear en catálogo maestro. Rack pad incluye rollos. CON INSTALACION Y ENVIO. Vendedor Yohan S.' where numero = 'OP_WA_0002';
update ordenes_pedido set notas = 'COLOR: columnas GRIS CLARO, resto negro. Vendedor Yohan S.' where numero = 'OP_WA_0005';
update ordenes_pedido set notas = 'INCLUYE INSTALACION Y ENVIO. Vendedor Yohan S.' where numero = 'OP_WA_0006';
update ordenes_pedido set notas = 'Vendedor Yohan S.' where numero = 'OP_WA_0007';
update ordenes_pedido set notas = 'Almacenador de agarres con 10 ganchos. CON INSTALACION Y ENVIO. Vendedor Yohan S.' where numero = 'OP_WA_0008';
update ordenes_pedido set notas = 'COLOR: uniones perforadas, J locks y landmine en AMARILLO VIVO; resto negro. Mancuernas 30/35/45kg (×2 c/u) y discos en lbs PENDIENTES: crear/confirmar en catálogo maestro. Parte de implementos ya despachados. Vendedor Yohan S.' where numero = 'OP_WA_0009';
update ordenes_pedido set notas = 'COLOR: barra pull up, platina fija de fondos y barra de fondos en ROJO; resto negro. Gancho soldado arriba en barra pull up (para TRX). Vendedor Yohan S.' where numero = 'OP_WA_0010';
update ordenes_pedido set notas = 'PF5 abatible tipo Andres Bernal (para tener bloques). Vendedor Yohan S.' where numero = 'OP_WA_0011';
update ordenes_pedido set notas = 'COLOR: columnas DORADAS, resto negro. PF5 abatible. Vendedor Yohan S.' where numero = 'OP_WA_0012';
update ordenes_pedido set notas = 'Discos 20kg ×2 y 10kg ×2 PENDIENTES de crear en catálogo maestro (discos en kg). Vendedor Yohan S.' where numero = 'OP_WA_0014';
update ordenes_pedido set notas = 'Tiene un rack S15. Vendedor Yohan S.' where numero = 'OP_WA_0015';

-- Verificación: ítems y colores por OP
select o.numero, count(oi.id) as items,
       string_agg(distinct coalesce(oi.color,'(sin color)'), ', ') as colores
  from ordenes_pedido o
  join op_items oi on oi.op_id = o.id
 where o.numero like 'OP\_WA\_%'
 group by o.numero order by o.numero;
