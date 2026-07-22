-- ============================================================
-- SCRIPT 5 · CARGA DE OPs — PARTE B: ítems, despachos, garantías
-- ============================================================
-- Corre DESPUÉS del script 4 (las 39 OPs deben existir).
-- Contenido:
--   0. 2 productos de última milla (kettlebell 4kg, mancuerna 45kg real)
--   1. Ítems de las 39 OPs (precio = lista; especiales con descripción)
--   2. Ítems FALTANTES de OP_WA_0009 (Valbuena, 3 páginas nuevas)
--   3. Despachos iniciales (lo RESALTADO = ya entregado/enviado)
--   4. 2 garantías sin OP original (Lina María, Jhon Fredy Arenas)
--   5. Marca "NO descontar inventario" en las 7 OPs ya en proceso
--   6. Bump de secuencias.op
-- Guardia de idempotencia: si OP_WA_0017 ya tiene ítems, no repite.
-- PENDIENTE APARTE: ítems de Casa Nua (OP_WA_0022) — Juan debe pasar
-- el detalle; su entrega del 18-jun se registra cuando existan.
-- ============================================================

-- ---- 0. Productos de última milla --------------------------
insert into productos (sku, nombre, categoria_id, clasificacion, origen, es_rack, unidad_id, precio_lista)
select v.sku, v.nombre, c.id, 'MTS', 'comercializado', false,
       (select id from unidades_medida where clave='und'), v.precio
from (values
  ('6Kb4kg','Kettlebell 4kg',0),
  ('6MaHex45kg','Mancuernas Hexagonales encauchetadas 45kg',517500)
) as v(sku,nombre,precio)
join categorias_producto c on c.clave = 'fuerza'
on conflict (sku) do nothing;

do $$
declare
  v_user uuid; v_encola smallint; v_cli uuid; v_num text; r record;
begin
  if exists (select 1 from op_items oi join ordenes_pedido o on o.id = oi.op_id
              where o.numero = 'OP_WA_0017') then
    raise notice 'La parte B ya se cargó; no se repite.'; return;
  end if;

  select id into strict v_user   from usuarios where email = 'juanmoreno@bravefit.co';
  select id into strict v_encola from etapas_produccion where nombre = 'En Cola';

  -- ======== 1+2 · ÍTEMS (incluye los faltantes de WA_0009) ========
  for r in
    select * from (values
      -- 0017 Verónica Cristancho
      ('OP_WA_0017','1RaPF5f',1,null,'Barra Tipo M'),
      ('OP_WA_0017','3SmithCmov',1,null,null),
      ('OP_WA_0017','3PoMov',2,null,'graduables'),
      ('OP_WA_0017','6BaPle',1,null,null),
      ('OP_WA_0017','8AlmBanc',1,null,null),
      ('OP_WA_0017','3Fond',1,null,null),
      ('OP_WA_0017','3PoRa2',1,null,null),
      -- 0018 José Pablo Montoya
      ('OP_WA_0018','1RaPF5p',1,null,'Platinas abatibles x4'),
      ('OP_WA_0018','3Fond',1,null,null),
      ('OP_WA_0018','8AlmFond',1,null,'a pared'),
      ('OP_WA_0018','3Land',1,null,null),
      ('OP_WA_0018','6BaPla',1,null,null),
      ('OP_WA_0018','8AlmBanc',1,null,null),
      ('OP_WA_0018','8aldipa3',1,null,null),
      ('OP_WA_0018','3Especial',1,null,'Soportes de escritorio a rack (NO incluye tabla - pedir plano a Daniel)'),
      ('OP_WA_0018','3PoRa2',1,null,null),
      ('OP_WA_0018','6BaOlCro15kg',1,null,null),
      ('OP_WA_0018','6MaHex30kg',2,null,null),
      ('OP_WA_0018','6DiBum10lb',4,null,null),
      ('OP_WA_0018','6DiBum15lb',2,null,null),
      ('OP_WA_0018','6DiBum25lb',2,null,null),
      -- 0019 Carolina Álzate (rack BLANCO)
      ('OP_WA_0019','1RaPF5f',1,'Blanco','TODO el rack en blanco: columnas, uniones y barra (Tipo M)'),
      ('OP_WA_0019','3PoMov',1,null,null),
      ('OP_WA_0019','3Land',1,null,null),
      ('OP_WA_0019','3LeRo',1,null,null),
      ('OP_WA_0019','8TaAlmAgPo',1,null,null),
      ('OP_WA_0019','8AlmFitb',1,null,null),
      ('OP_WA_0019','8AlmEl5pos',1,null,'para 5 puestos'),
      ('OP_WA_0019','3PoRa2',1,null,'a pared'),
      ('OP_WA_0019','8aldipa3',1,null,'mirar render'),
      ('OP_WA_0019','8Especial',1,null,'Mueble de bandejas 0.6m ancho x 1.5m alto x 0.3m fondo'),
      -- 0020 Buy Flex SAS
      ('OP_WA_0020','1RaPF5f',1,null,'Barra Tipo M'),
      ('OP_WA_0020','3PoMov',2,null,'graduable'),
      -- 0021 Henry Alexander Chaves
      ('OP_WA_0021','1RaPF5f',1,null,'Barra Tipo M'),
      ('OP_WA_0021','3PoMov',2,null,'INTEGRADO'),
      ('OP_WA_0021','3SmithCmov',1,null,null),
      ('OP_WA_0021','6BaPle',1,null,null),
      ('OP_WA_0021','3Fond',1,null,null),
      ('OP_WA_0021','8aldipa3',1,null,null),
      ('OP_WA_0021','8ToAlMan5',1,null,'de mancuernas'),
      ('OP_WA_0021','3PoRa2',1,null,'a pared'),
      ('OP_WA_0021','8AlmBanc',1,null,null),
      ('OP_WA_0021','8TaAlmAgPo',1,null,null),
      ('OP_WA_0021','3RaPa',1,null,'con rollos'),
      ('OP_WA_0021','3BrTul',1,null,'a pared'),
      ('OP_WA_0021','3DualFlex',1,null,null),
      ('OP_WA_0021','6BaOlCro15kg',1,null,null),
      ('OP_WA_0021','6DiBum10lb',4,null,null),
      ('OP_WA_0021','6DiBum15lb',4,null,null),
      ('OP_WA_0021','6MaHex2.5kg',2,null,null),
      ('OP_WA_0021','6MaHex5kg',2,null,null),
      ('OP_WA_0021','6MaHex7.5kg',2,null,null),
      ('OP_WA_0021','6MaHex10kg',2,null,null),
      ('OP_WA_0021','8PisCacuAlf',2.5,null,'10 laminas'),
      ('OP_WA_0021','3AgLazo',1,null,null),
      ('OP_WA_0021','3AgTob',1,null,null),
      ('OP_WA_0021','3AgPulUp',2,null,'espalda'),
      ('OP_WA_0021','3AgIndivid',1,null,null),
      ('OP_WA_0021','7TulaBox30',1,null,null),
      ('OP_WA_0021','7Step2N',2,null,null),
      ('OP_WA_0021','7LazoCross',1,null,null),
      ('OP_WA_0021','7SetTrxPro',1,null,'TRX PRO'),
      ('OP_WA_0021','7KitBanPod',1,null,null),
      ('OP_WA_0021','7KitBanTub',1,null,null),
      ('OP_WA_0021','7Col1m',1,null,null),
      ('OP_WA_0021','7Bosu',1,null,null),
      ('OP_WA_0021','6Kb10kg',1,null,'pesa rusa'),
      ('OP_WA_0021','6Kb12kg',1,null,'pesa rusa'),
      ('OP_WA_0021','7FoamRol',1,null,null),
      -- 0023 Elkin Yovany Pérez
      ('OP_WA_0023','1RaS15',1,null,null),
      -- 0024 Juan Sebastián Quintero
      ('OP_WA_0024','1RaPF5f',1,null,null),
      ('OP_WA_0024','7PuUpSy',1,null,null),
      -- 0025 Rubén Darío Londoño
      ('OP_WA_0025','7DapBar',1,'Negro','todo negro'),
      -- 0026 Hernando Abdu
      ('OP_WA_0026','1RaPF5f',1,'Negro','TODO NEGRO'),
      ('OP_WA_0026','3PoMov',1,null,null),
      ('OP_WA_0026','8AlmFond',1,null,null),
      ('OP_WA_0026','3Fond',1,null,null),
      ('OP_WA_0026','6BaPle',1,null,null),
      ('OP_WA_0026','3LeRo',1,null,null),
      ('OP_WA_0026','8ToAlMan5',1,null,null),
      ('OP_WA_0026','8aldipa3',1,null,null),
      ('OP_WA_0026','3PoRa2',1,null,null),
      ('OP_WA_0026','8TaAlmAgPo',1,null,null),
      ('OP_WA_0026','7Col1m',1,null,null),
      ('OP_WA_0026','6BaOlCro15kg',1,null,null),
      ('OP_WA_0026','6DiBum10lb',4,null,null),
      ('OP_WA_0026','6DiBum15lb',4,null,null),
      ('OP_WA_0026','6DiBum25lb',4,null,null),
      ('OP_WA_0026','6MaHex5kg',2,null,null),
      ('OP_WA_0026','6MaHex7.5kg',2,null,null),
      ('OP_WA_0026','6MaHex10kg',2,null,null),
      ('OP_WA_0026','6MaHex12.5kg',2,null,null),
      ('OP_WA_0026','6MaHex15kg',2,null,null),
      ('OP_WA_0026','3AgPulUp',1,null,null),
      ('OP_WA_0026','3AgTob',1,null,null),
      ('OP_WA_0026','3AgLazo',1,null,null),
      ('OP_WA_0026','3AgIndivid',1,null,null),
      -- 0027 Reactive Move SAS (PF10 V2.0 + Rack 3M en una OP)
      ('OP_WA_0027','1RaPF10V2',1,null,'Platina fija x18 segun formato'),
      ('OP_WA_0027','6SisPolPared',2,null,'sistema de poleas INDIVIDUAL A PARED (no al rack)'),
      ('OP_WA_0027','6BaPle',1,null,null),
      ('OP_WA_0027','3ADR',2,null,null),
      ('OP_WA_0027','3Land',1,null,null),
      ('OP_WA_0027','3Especial',2,null,'Soporte TRX'),
      ('OP_WA_0027','5HQRo',1,null,null),
      ('OP_WA_0027','3SmithCmov',1,null,'a rack'),
      ('OP_WA_0027','7Step2N',3,null,null),
      ('OP_WA_0027','8ToAlMan8',1,null,'almacenador de 8 pares de mancuernas A PARED'),
      ('OP_WA_0027','2RiPa3m',1,null,'"Rack 3M": columnas 2.7m x3, barras a pared 1.8m x3, barra central 1m-1.8m x2, chazos piso'),
      ('OP_WA_0027','3BrTul',1,null,null),
      -- 0028 Orlando Cuello
      ('OP_WA_0028','2RiPa4m',2,null,'RIG 4M PARED: 8 col 3m negras, 8 barras pared 1m ROJAS, 6 barras centrales (4x1m + 2x1.5m)'),
      ('OP_WA_0028','3JLo',4,null,'pares'),
      ('OP_WA_0028','3BrHam11',4,'Rojo','pares'),
      ('OP_WA_0028','3SoSeSe',4,'Rojo','pares'),
      ('OP_WA_0028','3Land',4,'Rojo',null),
      ('OP_WA_0028','3TargAl',2,'Rojo',null),
      ('OP_WA_0028','3LeRo',2,null,null),
      ('OP_WA_0028','7CuIndivi',1,null,'par'),
      ('OP_WA_0028','1RaPF5f',1,null,'columna 2.4m, barra 1.2m Tipo M, uniones ROJAS'),
      ('OP_WA_0028','3PoMov',2,null,'guias lo mas largas posible, agarres x2 c/u'),
      ('OP_WA_0028','3RaPa',2,null,'con rollos'),
      ('OP_WA_0028','3AgLazo',2,null,null),
      ('OP_WA_0028','3AgTob',2,null,null),
      ('OP_WA_0028','3AgPulUp',2,null,null),
      ('OP_WA_0028','3AgIndivid',2,null,null),
      -- 0029 Jamer Fernández
      ('OP_WA_0029','1RaPF5f',1,null,'uniones NEGRO'),
      ('OP_WA_0029','3Fond',1,null,null),
      ('OP_WA_0029','8aldipa3',1,null,null),
      ('OP_WA_0029','6BaPle',1,null,null),
      ('OP_WA_0029','8ToAlMan8',1,null,null),
      ('OP_WA_0029','3PoRa2',1,null,null),
      ('OP_WA_0029','6BaOlCro20kg',1,null,null),
      ('OP_WA_0029','6DiBum10lb',2,null,null),
      ('OP_WA_0029','6DiBum15lb',2,null,null),
      ('OP_WA_0029','6DiBum25lb',2,null,null),
      ('OP_WA_0029','6MaHex5kg',2,null,null),
      ('OP_WA_0029','6MaHex7.5kg',2,null,null),
      ('OP_WA_0029','6MaHex10kg',2,null,null),
      ('OP_WA_0029','6MaHex12.5kg',2,null,null),
      ('OP_WA_0029','6MaHex15kg',2,null,null),
      -- 0030 Roca Business SAS
      ('OP_WA_0030','1RaPF5p',1,null,'platinas abatibles x4'),
      ('OP_WA_0030','8aldipa4',1,null,null),
      ('OP_WA_0030','8Especial',1,null,'Almacenador de 2 barras a pared'),
      -- 0031 Ana María Álvarez
      ('OP_WA_0031','1RaSR5',1,null,'cols 2.2m x4, uniones perforadas NEGRAS, 8 platinas triangulares (P007), bases PTS 2x1.2m + 1x1m'),
      ('OP_WA_0031','3Fond',1,null,null),
      ('OP_WA_0031','3Land',1,null,null),
      ('OP_WA_0031','3PoRa2',1,null,null),
      ('OP_WA_0031','3ADR',3,null,null),
      ('OP_WA_0031','6BaPle',1,null,null),
      ('OP_WA_0031','8Especial',1,null,'Almacenador mixto 1.8m 3N'),
      ('OP_WA_0031','3SoSeSe',1,null,'par'),
      ('OP_WA_0031','6Kb4kg',1,null,null),
      ('OP_WA_0031','6Kb8kg',1,null,null),
      ('OP_WA_0031','6Kb12kg',1,null,null),
      ('OP_WA_0031','6Kb16kg',1,null,null),
      ('OP_WA_0031','6Kb20kg',1,null,null),
      ('OP_WA_0031','7BalMed20lb',1,null,null),
      ('OP_WA_0031','7BalMed15lb',1,null,'pedido de 14lbs, se mando de 7kg'),
      ('OP_WA_0031','7CaMaMe',1,null,null),
      ('OP_WA_0031','7Col1m',2,null,null),
      ('OP_WA_0031','8PisCauSpon',24,null,'24 m2 = 96 unidades'),
      ('OP_WA_0031','6BaOlNeg20kg',1,null,null),
      ('OP_WA_0031','6DiBum10lb',4,null,null),
      ('OP_WA_0031','6DiBum15lb',4,null,null),
      ('OP_WA_0031','6DiBum25lb',2,null,null),
      ('OP_WA_0031','6DiBum35lb',2,null,null),
      ('OP_WA_0031','6DiBum45lb',2,null,null),
      ('OP_WA_0031','6MaHex2.5kg',2,null,null),
      ('OP_WA_0031','6MaHex5kg',2,null,null),
      ('OP_WA_0031','6MaHex7.5kg',2,null,null),
      ('OP_WA_0031','6MaHex10kg',2,null,null),
      ('OP_WA_0031','6MaHex12.5kg',2,null,null),
      ('OP_WA_0031','6MaHex15kg',2,null,null),
      ('OP_WA_0031','6MaHex17.5kg',2,null,null),
      ('OP_WA_0031','6MaHex20kg',2,null,null),
      ('OP_WA_0031','6MaHex22.5kg',2,null,'el 25 se corrigio a 22.5'),
      ('OP_WA_0031','6MaHex30kg',2,null,null),
      ('OP_WA_0031','6MaHex35kg',2,null,null),
      ('OP_WA_0031','6MaHex40kg',2,null,null),
      -- 0032 Kafury y Zukuaga SAS
      ('OP_WA_0032','8PortBaPa3',1,null,null),
      ('OP_WA_0032','8aldipa3',1,null,'a pared'),
      -- 0033 Urbanización Santa Fe
      ('OP_WA_0033','1RaPF5f',2,null,'uniones NEGRAS'),
      ('OP_WA_0033','3PoMov',2,null,null),
      ('OP_WA_0033','3SmithTr',1,null,'tradicional'),
      ('OP_WA_0033','3Land',1,null,null),
      ('OP_WA_0033','3Fond',1,null,null),
      ('OP_WA_0033','3LeRo',1,null,null),
      ('OP_WA_0033','3BrTul',1,null,null),
      ('OP_WA_0033','8TaAlmAgPo',1,null,null),
      ('OP_WA_0033','6BaPle',1,null,null),
      ('OP_WA_0033','6BaPla',1,null,null),
      ('OP_WA_0033','8ArAlmDisN3',1,null,'arbol discos 3N con almacenador de 2 barras'),
      ('OP_WA_0033','8AlmFond',1,null,null),
      ('OP_WA_0033','6BaOlCro15kg',1,null,null),
      ('OP_WA_0033','6DiBum10lb',8,null,null),
      ('OP_WA_0033','6DiBum15lb',8,null,null),
      ('OP_WA_0033','6DiBum25lb',4,null,null),
      ('OP_WA_0033','6DiBum35lb',2,null,null),
      ('OP_WA_0033','6MaHex7.5kg',2,null,null),
      ('OP_WA_0033','6MaHex12.5kg',2,null,null),
      ('OP_WA_0033','6MaHex17.5kg',2,null,null),
      ('OP_WA_0033','3AgLazo',1,null,null),
      ('OP_WA_0033','3AgTob',1,null,null),
      ('OP_WA_0033','3AgPulUp',1,null,null),
      ('OP_WA_0033','3AgIndivid',1,null,null),
      ('OP_WA_0033','7TrotShark',1,null,'trotadora Shock'),
      ('OP_WA_0033','7SpinRGo',1,null,null),
      ('OP_WA_0033','7TulaBox30',1,null,null),
      -- 0034 Jorge Ayala
      ('OP_WA_0034','1RaPF5f',1,null,null),
      ('OP_WA_0034','3PoMov',1,null,'para el lado derecho'),
      ('OP_WA_0034','6BaPle',1,null,null),
      ('OP_WA_0034','3AgLazo',1,null,null),
      ('OP_WA_0034','3AgTob',1,null,null),
      ('OP_WA_0034','3AgPulUp',1,null,null),
      ('OP_WA_0034','3AgIndivid',1,null,null),
      -- 0035 Carlos Mario Otálvaro
      ('OP_WA_0035','1RaPF5p',1,'Negro','COLUMNA ESPECIAL 2.15m (confirmada), platinas abatibles x4'),
      -- 0036 Ricardo Agudelo
      ('OP_WA_0036','7DcBar',1,null,'OJO VER RENDER'),
      ('OP_WA_0036','3PoMov',1,null,'OJO VER RENDER'),
      -- 0037 Natalia Barrientos
      ('OP_WA_0037','1RaPF5p',1,null,'platinas abatibles x4'),
      ('OP_WA_0037','3SoSeSe',1,null,'par'),
      -- 0038 Christopher Brooks
      ('OP_WA_0038','1RaPF5f',1,null,'Barra Tipo M, uniones 0.5m'),
      ('OP_WA_0038','3PoMov',1,null,null),
      ('OP_WA_0038','6BaPle',1,null,null),
      ('OP_WA_0038','8PisCacuAlf',2.25,null,'9 laminas'),
      -- 0039 Nelson Rodríguez
      ('OP_WA_0039','1RaPF5f',1,null,'Barra Tipo M'),
      ('OP_WA_0039','3Fond',1,null,null),
      ('OP_WA_0039','3SoSeSe',1,null,'par'),
      ('OP_WA_0039','3Land',1,null,null),
      ('OP_WA_0039','6BaOlCro20kg',1,null,null),
      -- 0040 Juan Raúl Garzón
      ('OP_WA_0040','1RaPF5f',1,null,'Barra Tipo M'),
      ('OP_WA_0040','3Fond',1,null,null),
      -- 0041 Carlos Daniel Ortiz Pico
      ('OP_WA_0041','8CarAlmDis',1,null,'el formato decia "almacenador de discos horizontal de 1.5m"'),
      -- 0042 Aider Duque
      ('OP_WA_0042','8TaAlmAgPo',1,null,'con 7 ganchos'),
      ('OP_WA_0042','8GaBosu',1,null,'almacenador de bosu'),
      ('OP_WA_0042','8Especial',1,null,'Columna a pared almacenadora de accesorios de 1.8m de largo (boceto en formato)'),
      ('OP_WA_0042','8AlmEl5pos',1,null,'almacenador de bandas a pared para 5 puestos'),
      ('OP_WA_0042','8Especial',1,null,'Almacenador de balones a pared de 1.5m de largo (boceto en formato)'),
      -- 0043 The Host Group SAS
      ('OP_WA_0043','1RaS7',1,null,'columnas 2.3m, Xbean x4 0.6m, chazos de PISO'),
      ('OP_WA_0043','6BaPle',1,null,null),
      ('OP_WA_0043','8MuManN213',1,null,'modelo nuevo'),
      ('OP_WA_0043','6MaHex2.5kg',2,null,null),
      ('OP_WA_0043','6MaHex5kg',2,null,null),
      ('OP_WA_0043','6MaHex7.5kg',2,null,null),
      ('OP_WA_0043','6MaHex10kg',2,null,null),
      ('OP_WA_0043','6MaHex12.5kg',2,null,null),
      ('OP_WA_0043','7Col1m',4,null,null),
      ('OP_WA_0043','7SetTrxPro',1,null,null),
      -- 0044 Ricardo Umaña
      ('OP_WA_0044','3Fond',1,null,null),
      -- 0045 Emilson Porras
      ('OP_WA_0045','5RaSS22',1,null,'bases PTS con 4 platinas de fijacion a piso; union xbean con 2 platinas triangulares soldadas'),
      -- 0046 Alfonso González
      ('OP_WA_0046','7DcBar',1,null,'con gancho TRX y mosqueton en barra pull up + fondo abatible'),
      -- 0047 Carlos Eduardo Medina
      ('OP_WA_0047','8ToAlMan8',1,null,null),
      ('OP_WA_0047','8aldipa3',1,null,null),
      ('OP_WA_0047','6MaHex5kg',2,null,null),
      ('OP_WA_0047','6MaHex7.5kg',2,null,null),
      ('OP_WA_0047','6MaHex10kg',2,null,null),
      ('OP_WA_0047','6MaHex12.5kg',2,null,null),
      ('OP_WA_0047','6MaHex15kg',2,null,null),
      ('OP_WA_0047','6MaHex17.5kg',2,null,null),
      ('OP_WA_0047','6MaHex20kg',2,null,null),
      ('OP_WA_0047','6MaHex22.5kg',2,null,'el 25 se corrigio a 22.5'),
      ('OP_WA_0047','6MaHex30kg',2,null,null),
      ('OP_WA_0047','3Especial',2,null,'Columna 2.2m (las 2 del medio de un PF10; el cliente ya tiene 2 con barra M)'),
      ('OP_WA_0047','3Especial',8,null,'Xbean 50cm'),
      ('OP_WA_0047','3Especial',1,null,'Barra sencilla 1m'),
      ('OP_WA_0047','3Fond',1,null,null),
      ('OP_WA_0047','3SoSeSe',1,null,'par'),
      ('OP_WA_0047','3Land',1,null,null),
      -- 0048 Motion Nomads SAS
      ('OP_WA_0048','3SmithTr',1,null,'el cliente ya tiene un PF5'),
      -- 0049 Mónica Mejía
      ('OP_WA_0049','1RaS7',1,null,null),
      -- 0050 Luis Fajardo
      ('OP_WA_0050','3RaPa',1,null,null),
      ('OP_WA_0050','3LeRo',1,null,null),
      ('OP_WA_0050','3Land',1,null,null),
      ('OP_WA_0050','3ADR',1,null,null),
      -- 0051 María José Barajas
      ('OP_WA_0051','7DcBar',1,null,null),
      ('OP_WA_0051','1RaPF5f',1,null,null),
      ('OP_WA_0051','8ArAlmDisN2',2,null,'arbol almacenador de discos'),
      -- 0052 Moon RA SAS
      ('OP_WA_0052','1RaPF5f',1,null,null),
      ('OP_WA_0052','3PoMov',2,null,null),
      ('OP_WA_0052','3SmithTr',1,null,null),
      ('OP_WA_0052','3LeRo',1,null,null),
      -- 0053 Ernesto Ramírez
      ('OP_WA_0053','3PoMov',1,null,'para el lado derecho de un PF5 que el cliente ya tiene'),
      ('OP_WA_0053','3Especial',4,null,'Xbean 50cm SIN tornilleria'),
      -- 0054 Daniel Guzmán
      ('OP_WA_0054','1RaPF5f',1,null,null),
      ('OP_WA_0054','8PortBaPa3',1,null,null),
      ('OP_WA_0054','8aldipa3',1,null,null),
      ('OP_WA_0054','3SoSeSe',1,null,'par'),
      ('OP_WA_0054','3Land',1,null,null),
      -- 0055 Rene Lizarazo
      ('OP_WA_0055','5HQRo',1,null,null),
      -- ==== FALTANTES DE OP_WA_0009 (Valbuena, 3 páginas) ====
      ('OP_WA_0009','6BaOlNeg15kg',1,null,'2m'),
      ('OP_WA_0009','6BaOlNeg20kg',1,null,'2.2m'),
      ('OP_WA_0009','3AgPulUp',1,null,null),
      ('OP_WA_0009','3AgIndivid',2,null,null),
      ('OP_WA_0009','3AgTob',1,null,null),
      ('OP_WA_0009','3AgLazo',1,null,null),
      ('OP_WA_0009','6MaHex5kg',2,null,null),
      ('OP_WA_0009','6MaHex7.5kg',2,null,null),
      ('OP_WA_0009','6MaHex10kg',2,null,null),
      ('OP_WA_0009','6MaHex12.5kg',2,null,null),
      ('OP_WA_0009','6MaHex15kg',2,null,null),
      ('OP_WA_0009','6MaHex17.5kg',2,null,null),
      ('OP_WA_0009','6MaHex20kg',2,null,null),
      ('OP_WA_0009','6MaHex25kg',2,null,null),
      ('OP_WA_0009','6MaHex30kg',2,null,null),
      ('OP_WA_0009','6MaHex35kg',2,null,null),
      ('OP_WA_0009','6MaHex45kg',2,null,null),
      ('OP_WA_0009','6DiBum10lb',4,null,null),
      ('OP_WA_0009','6DiBum15lb',4,null,null),
      ('OP_WA_0009','6DiBum25lb',2,null,null),
      ('OP_WA_0009','6DiBum35lb',2,null,null),
      ('OP_WA_0009','6DiBum45lb',2,null,null),
      ('OP_WA_0009','3DualFlex',1,null,'accesorio a rack dual flex'),
      ('OP_WA_0009','6Kb6kg',1,null,null),
      ('OP_WA_0009','6Kb10kg',1,null,null),
      ('OP_WA_0009','6Kb12kg',1,null,null),
      ('OP_WA_0009','6Kb16kg',1,null,null),
      ('OP_WA_0009','6Kb24kg',1,null,null),
      ('OP_WA_0009','6BaRec12',1,null,null),
      ('OP_WA_0009','6BaRom',1,null,null),
      ('OP_WA_0009','6BaHex',1,null,null),
      ('OP_WA_0009','7Step3N',1,null,null),
      ('OP_WA_0009','7KitBanRes',1,null,null),
      ('OP_WA_0009','7LazoCross',2,null,null),
      ('OP_WA_0009','3PoRa2',1,null,'almacenador de 2 barras'),
      ('OP_WA_0009','8PortBaPa3',1,null,'almacenador de 3 barras'),
      ('OP_WA_0009','7SetTrxPro',1,null,'TRX P3 PRO'),
      ('OP_WA_0009','7KitBanTub',1,null,'kit de bandas de goma'),
      ('OP_WA_0009','7PilCama',1,null,'Pilates Cama Bravefit'),
      ('OP_WA_0009','6PrensaEvo',1,null,null)
    ) as t(numero, sku, cant, color, obs)
  loop
    insert into op_items (op_id, producto_id, cantidad, precio_unit, color, descripcion)
    select o.id, p.id, r.cant, p.precio_lista, r.color, r.obs
      from ordenes_pedido o, productos p
     where o.numero = r.numero and p.sku = r.sku;
  end loop;

  -- Columna especial de Otálvaro: 2.15m como override de alto
  update op_items oi set alto_override_cm = 215
    from ordenes_pedido o, productos p
   where o.id = oi.op_id and p.id = oi.producto_id
     and o.numero = 'OP_WA_0035' and p.sku = '1RaPF5p';

  -- ======== 3 · DESPACHOS INICIALES (lo resaltado) ========
  -- (numero, sku, fecha, nota) — cantidad = la total del ítem.
  for r in
    select * from (values
      -- Carolina: todo entregado MENOS la polea (3PoMov)
      ('OP_WA_0019','1RaPF5f','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','3Land','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','3LeRo','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','8TaAlmAgPo','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','8AlmFitb','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','8AlmEl5pos','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','3PoRa2','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','8aldipa3','2026-07-10','Entregado antes del ERP'),
      ('OP_WA_0019','8Especial','2026-07-10','Entregado antes del ERP'),
      -- Henry: entregado 22-jul salvo smith, kit tubulares, pesas rusas y foam
      ('OP_WA_0021','1RaPF5f','2026-07-22','Entregado 22-jul (antes del ERP)'),
      ('OP_WA_0021','3PoMov','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6BaPle','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3Fond','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','8aldipa3','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','8ToAlMan5','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3PoRa2','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','8AlmBanc','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','8TaAlmAgPo','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3RaPa','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3BrTul','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3DualFlex','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6BaOlCro15kg','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6DiBum10lb','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6DiBum15lb','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6MaHex2.5kg','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6MaHex5kg','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6MaHex7.5kg','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','6MaHex10kg','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','8PisCacuAlf','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3AgLazo','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3AgTob','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3AgPulUp','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','3AgIndivid','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','7TulaBox30','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','7Step2N','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','7LazoCross','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','7SetTrxPro','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','7KitBanPod','2026-07-22','Entregado 22-jul'),
      ('OP_WA_0021','7Col1m','2026-07-22','Entregado 22-jul (colchoneta confirmada por Juan)'),
      ('OP_WA_0021','7Bosu','2026-07-22','Entregado 22-jul'),
      -- Ana María: lo marcado ENVIADO
      ('OP_WA_0031','7BalMed15lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','7CaMaMe','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','7Col1m','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','8PisCauSpon','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6BaOlNeg20kg','2026-07-15','Enviado antes del ERP (pag 3 toda enviada)'),
      ('OP_WA_0031','6DiBum10lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6DiBum15lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6DiBum25lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6DiBum35lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6DiBum45lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex2.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex7.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex10kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex12.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex15kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex17.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex20kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex22.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex30kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex35kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0031','6MaHex40kg','2026-07-15','Enviado antes del ERP'),
      -- Kafury y Rene: enviados HOY
      ('OP_WA_0032','8PortBaPa3','2026-07-22','Enviado 22-jul-2026'),
      ('OP_WA_0032','8aldipa3','2026-07-22','Enviado 22-jul-2026'),
      ('OP_WA_0055','5HQRo','2026-07-22','Enviado 22-jul-2026'),
      -- Valbuena: lo resaltado ENVIADO (pendientes: dual flex y prensa EVO)
      ('OP_WA_0009','6BaOlNeg15kg','2026-07-15','Enviado antes del ERP (resaltado)'),
      ('OP_WA_0009','6BaOlNeg20kg','2026-07-15','Enviado antes del ERP (resaltado)'),
      ('OP_WA_0009','3AgPulUp','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','3AgIndivid','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','3AgTob','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','3AgLazo','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex7.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex10kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex12.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex15kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex17.5kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex20kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex25kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex30kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex35kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6MaHex45kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6DiBum10lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6DiBum15lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6DiBum25lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6DiBum35lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6DiBum45lb','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6Kb6kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6Kb10kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6Kb12kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6Kb16kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6Kb24kg','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6BaRec12','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6BaRom','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','6BaHex','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','7Step3N','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','7KitBanRes','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','7LazoCross','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','3PoRa2','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','8PortBaPa3','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','7SetTrxPro','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','7KitBanTub','2026-07-15','Enviado antes del ERP'),
      ('OP_WA_0009','7PilCama','2026-07-15','DESPACHADA la cama de pilates (nota manuscrita)')
    ) as t(numero, sku, fecha, nota)
  loop
    insert into op_despachos (op_item_id, cantidad, usuario_id, nota, en)
    select oi.id, oi.cantidad, v_user, r.nota, (r.fecha || ' 12:00:00-05')::timestamptz
      from op_items oi
      join ordenes_pedido o on o.id = oi.op_id
      join productos p on p.id = oi.producto_id
     where o.numero = r.numero and p.sku = r.sku;
  end loop;

  -- ======== 4 · GARANTÍAS SIN OP ORIGINAL ========
  -- Lina María Restrepo Bonnet
  select id into v_cli from clientes where lower(nombre) = 'lina maria restrepo bonnet' limit 1;
  if v_cli is null then
    insert into clientes (tipo, nombre) values ('persona','Lina Maria Restrepo Bonnet')
    returning id into v_cli;
  end if;
  v_num := fn_siguiente_numero('garantia');
  insert into garantias (numero, cliente_id, problema, detalle, etapa_id, compra_original, recogida)
  values (v_num, v_cli,
    'Modificaciones y arreglos a equipos comprados antes del ERP',
    'Formato 17-jul-2026 (envio 16-ago): cambiar cojines; modificar apoya pies; fabricar dual flex; subir accesorios. Ver formato fisico para el detalle completo.',
    v_encola,
    'Compra anterior al ERP (sin OP en el sistema). Formato fisico del 17-jul-2026.',
    'por_definir');

  -- Jhon Fredy Arenas
  select id into v_cli from clientes where lower(nombre) = 'jhon fredy arenas' limit 1;
  if v_cli is null then
    insert into clientes (tipo, nombre) values ('persona','Jhon Fredy Arenas')
    returning id into v_cli;
  end if;
  v_num := fn_siguiente_numero('garantia');
  insert into garantias (numero, cliente_id, problema, detalle, etapa_id, compra_original, recogida)
  values (v_num, v_cli,
    'Ajustes y modificaciones a equipos comprados antes del ERP',
    'Formato inicio 23-jun, envio 25-jun (2 dias): barra central para PF5 plegable de 1m (devuelve la de 70cm); ajustar barra smith carros moviles al ancho de ganchos estandar; soportes para discos olimpicos de carros moviles x2; modificar almacenador de discos a pared a 3 niveles olimpicos + 1 nivel pequeno (dejar uno de los que tiene); reinstalar con epoxico; devuelve almacenador de barras. ADICIONALES VENDIDOS en el mismo formato: barra olimpica profesional mujer 15kg x1, discos 10kg x2, 15kg x2, 20kg x2. NO MUEVE INVENTARIO (ya estaba en proceso al arrancar el ERP).',
    v_encola,
    'Compra anterior al ERP (sin OP en el sistema). Formato "LOTE 6 julio".',
    'por_definir');

  -- ======== 5 · MARCA "NO DESCONTAR INVENTARIO" ========
  -- Las 7 OPs nuevas que YA estaban en proceso al arrancar el ERP
  -- (sus platinas se consumieron antes; el conteo del 21-jul ya lo refleja).
  perform set_config('bravefit.bom', '1', true);
  update ordenes_pedido
     set mp_descontada_en = timestamptz '2026-07-01 08:00:00-05'
   where numero in ('OP_WA_0019','OP_WA_0020','OP_WA_0021','OP_WA_0022',
                    'OP_WA_0027','OP_WA_0032','OP_WA_0055')
     and mp_descontada_en is null;
  perform set_config('bravefit.bom', '', true);

  -- ======== 6 · SECUENCIA DE OPs ========
  update secuencias
     set siguiente = coalesce(
           (select max(substring(numero from '(\d+)$')::int) from ordenes_pedido), 0) + 1
   where clave = 'op';
end $$;

-- Verificación 1: ítems y valor por OP (revisar contra los formatos).
select o.numero, c.nombre as cliente, count(oi.id) as items,
       sum(oi.cantidad * oi.precio_unit)::bigint as valor_total,
       sum(oi.cantidad_entregada * oi.precio_unit)::bigint as valor_entregado
  from ordenes_pedido o
  join clientes c on c.id = o.cliente_id
  left join op_items oi on oi.op_id = o.id
 where o.numero between 'OP_WA_0017' and 'OP_WA_0055' or o.numero = 'OP_WA_0009'
 group by o.numero, c.nombre
 order by o.numero;

-- Verificación 2: OPs marcadas "no descontar inventario".
select numero, mp_descontada_en from ordenes_pedido
 where mp_descontada_en is not null and numero like 'OP_WA_%'
 order by numero;

-- Verificación 3: las 2 garantías nuevas.
select g.numero, c.nombre, g.problema, g.compra_original is not null as sin_op
  from garantias g join clientes c on c.id = g.cliente_id
 order by g.abierta_en desc limit 2;

-- Verificación 4: secuencia de OP lista para la próxima venta.
select clave, prefijo, siguiente from secuencias where clave = 'op';
