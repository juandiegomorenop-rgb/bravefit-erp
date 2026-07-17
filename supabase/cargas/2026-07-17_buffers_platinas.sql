-- ============================================================
-- BUFFERS DE REPOSICIÓN POR CONSUMO — platinas e impresión 3D
-- Regla acordada: buffer_min = 2 semanas de consumo,
--                 buffer_max (óptimo) = 5 semanas de consumo,
-- calculado con ventas ene-1→jul-16 2026 × BOM por producto.
-- Cantidad a pedir sugerida = buffer_max − stock disponible.
-- Refs sin BOM consumidor aún quedan en 0 (sin semáforo):
--   P049, P051-P053, P065-P067, P069-P072, P079.
-- Idempotente (es un UPDATE de los mismos valores).
-- ============================================================

update materiales m
   set buffer_min = v.bmin,
       buffer_max = v.bmax
  from (values
    ('P001',  5,  12), ('P002', 25,  60), ('P003',  3,   8), ('P004',  3,   8),
    ('P005', 65, 160), ('P006',  9,  22), ('P007',  1,   2), ('P008',  6,  14),
    ('P009', 11,  28), ('P010',  5,  11), ('P011', 18,  44), ('P012', 18,  44),
    ('P013', 18,  44), ('P014', 17,  43), ('P015',  4,  10), ('P016',  4,   9),
    ('P017',  2,   4), ('P018',  2,   4), ('P019',  8,  20), ('P020',  4,  10),
    ('P021',  6,  15), ('P022',  7,  16), ('P024',  6,  15), ('P025',  6,  15),
    ('P026',  6,  15), ('P027', 15,  36), ('P028',  8,  18), ('P029',  6,  15),
    ('P030', 95, 240), ('P031',  3,   7), ('P033',  1,   3), ('P034',  2,   5),
    ('P035',  1,   3), ('P036',  4,  10), ('P037',  4,  10), ('P038',  4,  10),
    ('P039',  4,  10), ('P040',  4,  10), ('P041',  8,  19), ('P042',  8,  19),
    ('P043',  3,   8), ('P044',  6,  15), ('P045',  2,   4), ('P046',  1,   2),
    ('P047',  2,   5), ('P050', 14,  34), ('P054',  4,  10), ('P055',  2,   5),
    ('P056',  2,   5), ('P057',  1,   2), ('P058',  2,   5), ('P059',  1,   2),
    ('P060',  1,   3), ('P061',  5,  13), ('P062',  1,   3), ('P063',  1,   2),
    ('P064',  3,   6), ('P076',  1,   2), ('P077',  1,   2), ('P078',  1,   2),
    ('P080',  1,   2), ('i3D001', 27, 68), ('i3D002', 5, 11)
  ) as v(cod, bmin, bmax)
 where m.nombre like v.cod || ' ·%';

-- Verificación: cuántas quedan en cada estado del semáforo HOY.
select case
         when e.cantidad_disponible < m.buffer_min then 'REPONER'
         when m.buffer_max > 0 and e.cantidad_disponible > m.buffer_max then 'EXCESO'
         else 'OK'
       end as estado,
       count(*) as refs
  from materiales m
  join existencias e on e.material_id = m.id and e.tipo = 'materia_prima'
 where m.buffer_min > 0 or m.buffer_max > 0
 group by 1 order by 1;
