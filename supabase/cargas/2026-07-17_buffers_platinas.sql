-- ============================================================
-- BUFFERS DE REPOSICIÓN POR CONSUMO — platinas e impresión 3D
-- Regla acordada (ajustada por Juan 17-jul):
--   buffer_min = 2 semanas de consumo
--   buffer_max (óptimo) = 4 semanas de consumo
-- Cantidad a pedir sugerida = buffer_max − stock disponible.
-- Refs sin BOM consumidor aún quedan en 0 (sin semáforo):
--   P049, P051-P053, P065-P067, P069-P072, P079.
-- Idempotente (es un UPDATE de los mismos valores).
-- ============================================================

update materiales m
   set buffer_min = v.bmin,
       buffer_max = v.bmax
  from (values
    ('P001',  5,  10), ('P002', 25,  50), ('P003',  3,   6), ('P004',  3,   6),
    ('P005', 65, 125), ('P006',  9,  18), ('P007',  1,   2), ('P008',  6,  11),
    ('P009', 11,  22), ('P010',  5,   9), ('P011', 18,  35), ('P012', 18,  35),
    ('P013', 18,  35), ('P014', 17,  35), ('P015',  4,   9), ('P016',  4,   7),
    ('P017',  2,   4), ('P018',  2,   4), ('P019',  8,  16), ('P020',  4,   8),
    ('P021', 12,  24), ('P022',  7,  13), ('P024',  6,  12), ('P025',  6,  12),
    ('P026',  6,  12), ('P027', 15,  30), ('P028',  8,  15), ('P029',  6,  12),
    ('P030', 95, 190), ('P031',  3,   6), ('P033',  1,   2), ('P034',  2,   4),
    ('P035',  1,   2), ('P036',  4,   8), ('P037',  4,   8), ('P038',  4,   8),
    ('P039',  4,   8), ('P040',  4,   8), ('P041',  8,  15), ('P042',  8,  15),
    ('P043',  3,   6), ('P044',  6,  12), ('P045',  2,   3), ('P046',  1,   2),
    ('P047',  2,   4), ('P050', 14,  27), ('P054',  4,   8), ('P055',  2,   4),
    ('P056',  2,   4), ('P057',  1,   2), ('P058',  2,   4), ('P059',  1,   2),
    ('P060',  1,   2), ('P061', 11,  22), ('P062',  1,   2), ('P063',  1,   2),
    ('P064',  3,   5), ('P076',  1,   2), ('P077',  1,   2), ('P078',  1,   2),
    ('P080',  1,   2), ('i3D001', 27, 55), ('i3D002', 5, 9)
  ) as v(cod, bmin, bmax)
 where m.nombre like v.cod || ' ·%';

-- Verificación: cuántas refs quedan en cada estado del semáforo HOY.
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
