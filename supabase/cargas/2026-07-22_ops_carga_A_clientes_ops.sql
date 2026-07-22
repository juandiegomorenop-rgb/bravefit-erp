-- ============================================================
-- CARGA MASIVA DE OPs — PARTE A: ciudades, clientes y órdenes
-- ============================================================
-- 39 OPs numeradas OP_WA_0017 .. OP_WA_0055:
--   · 30 de la lista de OPs abiertas del Excel de Juan
--   · Carlos Eduardo Medina (fuera de lista, decisión de Juan)
--   · 7 nuevas del lote 6 (Lina María salió: es GARANTÍA)
--   · Rene Lizarazo
--
-- Reglas aplicadas:
--   · Origen WhatsApp, vendedor Yohan, etapa "En Cola".
--   · fecha_entrega_pactada = fecha de ENVÍO del formato + 15 días
--     (regla oficial de Juan; el Excel usaba creación+30 y NO manda).
--     EXCEPCIÓN José Pablo Montoya: 11-ago (re-pactada con el cliente).
--   · Clientes find-or-create por nombre (no duplica los ya cargados).
--   · Los ítems y los despachos van en la PARTE B.
--
-- Idempotente: si ya existe OP_WA_0017 no hace nada.
-- ⚠️ Correr DESPUÉS de los scripts de productos.
-- ============================================================

insert into ciudades (nombre, departamento) values
  ('Rionegro','Antioquia'), ('Bello','Antioquia'), ('Marinilla','Antioquia'),
  ('El Peñol','Antioquia'), ('El Retiro','Antioquia'), ('Bucaramanga','Santander'),
  ('Armenia','Quindío'), ('Pereira','Risaralda'), ('Fusagasugá','Cundinamarca'),
  ('Yumbo','Valle del Cauca'), ('San Andrés','San Andrés y Providencia')
on conflict (nombre, departamento) do nothing;

do $$
declare
  v_wa smallint; v_cola smallint; v_yohan uuid; v_cli uuid; r record;
begin
  if exists (select 1 from ordenes_pedido where numero = 'OP_WA_0017') then
    raise notice 'La carga OP_WA_0017+ ya existe; no se repite.'; return;
  end if;

  select id into strict v_wa   from origenes_op where clave = 'whatsapp';
  select id into strict v_cola from etapas_produccion where nombre = 'En Cola';
  select id into v_yohan from usuarios where lower(nombre) like '%yohan%' limit 1;

  -- ---------- CLIENTES (find-or-create por nombre) ----------
  for r in
    select * from (values
      ('persona','Veronica Cristancho','52999850','3052220530',null,'Envigado','Antioquia','CL 48C Sur #39A-205'),
      ('persona','Jose Pablo Montoya','1037570993','3006188084',null,'Medellín','Antioquia','Calle 18B Sur #38-54, Ed. Bastion del Campestre apto 602'),
      ('persona','Carolina Alzate','1037562266','3156499191','caro_alzate@gmail.com','Rionegro','Antioquia','Parcelacion Bosques de Sojonia casa 6'),
      ('empresa','Buy Flex SAS',null,null,null,'Bogotá','Cundinamarca',null),
      ('persona','Henry Alexander Chaves Parra','1128425812','3116974793','Henry_A_Chaves@hotmail.com','Envigado','Antioquia','Cra 24C #41 Sur-151, Parcelacion Finca Los Alpes Casa 171'),
      ('empresa','Casa Nua',null,null,null,'Medellín','Antioquia',null),
      ('persona','Elkin Yovany Perez Garcia',null,null,null,'Medellín','Antioquia',null),
      ('persona','Juan Sebastian Quintero Osorio',null,null,null,'Medellín','Antioquia',null),
      ('persona','Ruben Dario Londoño','14893385','3155748310',null,'Cali','Valle del Cauca',null),
      ('persona','Hernando Abdu',null,'3148229308',null,'El Retiro','Antioquia','Km 2 Via Don Diego, Urb. Bosques de Lorena Casa 7'),
      ('empresa','Reactive Move SAS','901840870','3214868546','info@reactivemove.com','Bogotá','Cundinamarca','Cra 46 #93-48, La Castellana'),
      ('persona','Orlando Cuello','18011665','3157031483',null,'San Andrés','San Andrés y Providencia','Barrio Back Road'),
      ('persona','Jamer Alberto Fernandez',null,null,null,'Medellín','Antioquia',null),
      ('empresa','Roca Business SAS','902050329',null,null,'Bogotá','Cundinamarca','Calle 49A #16-27'),
      ('persona','Ana Maria Alvarez','1027808982',null,null,'Rionegro','Antioquia','Vereda Sajonia'),
      ('empresa','Kafury y Zukuaga SAS','901183647','3155787207',null,'Cali','Valle del Cauca','Cra 35A #11B oeste 288 apto 1002B, Ed. Cristallo Towers'),
      ('empresa','Urbanizacion Santa Fe','900375149',null,null,'Medellín','Antioquia','Calle 68 Sur #37-45'),
      ('persona','Jorge Alonso Ayala','94381614','3144442300',null,'Cali','Valle del Cauca','Calle 16A #132-60 Casa 29, Colinas de Pance'),
      ('persona','Carlos Mario Otalvaro Giraldo',null,null,null,'Medellín','Antioquia',null),
      ('persona','Ricardo Agudelo Cardona','8162002','3146166189','ragudelo11@gmail.com','Envigado','Antioquia','Cra 25B #26 Sur-09, Urb. Sierra Verde casa 102'),
      ('persona','Natalia Barrientos Clavijo','1017242520','3043376164','cefnbc2021@gmail.com','Bello','Antioquia','Av 35 #44-66 segundo piso, barrio Las Vegas'),
      ('persona','Christopher Brooks','665162','15712495069','cbrooks86@gmail.com','Envigado','Antioquia','Cra 43A #49D Sur-72, Ed. Terrazzino Sur apto 1507'),
      ('persona','Nelson Ivan Rodriguez Malaver','1030624248','3123426260','nrodriguezmasalo@gmail.com','Bogotá','Cundinamarca','KR 78 N Bis A No 47B Sur-27, Kennedy Casablanca'),
      ('persona','Juan Raul Garzon Osorio','98668520','3124741793',null,'El Peñol','Antioquia','Vereda El Uvital Los Monjes'),
      ('persona','Carlos Daniel Ortiz Pico','1095948282','3102483537','carlosortiz035@hotmail.com','Bucaramanga','Santander','Carrera 34 #32-122'),
      ('persona','Aider Duque','70906992','3114248999','aadugduq@gmail.com','Marinilla','Antioquia','Cra 46 #29-84, Bariloche'),
      ('empresa','The Host Group SAS','901648743','3137720383',null,'Medellín','Antioquia','Calle 7D #43A-88'),
      ('persona','Ricardo Umaña','79723577','3002647350','ricardo.umanav@gmail.com','Medellín','Antioquia','Cra 20 #20 Sur-44, Urb. Piedemonte Casa 104, Poblado sector San Lucas'),
      ('persona','Emilson Andres Porras Rico','1094916556','3217669065','andrety9011@hotmail.com','Armenia','Quindío','Via El Caimo, Condominio Campestre Bambazu Casa 32'),
      ('persona','Alfonso Gonzalez','80091182','3107827868','donponcho@hotmail.com','Bogotá','Cundinamarca','Calle 112 #17-19 Apto 501, Malecon de los Molinos'),
      ('persona','Carlos Eduardo Medina Sanchez',null,'3228478006',null,'Pereira','Risaralda','Condominio Campestre La Maria, Casa 1'),
      ('empresa','Motion Nomads SAS','90204159',null,null,'Bogotá','Cundinamarca','Calle 93A #19-50 local'),
      ('persona','Monica Andrea Mejia Agudelo',null,null,null,'Yumbo','Valle del Cauca',null),
      ('persona','Luis Alfonso Fajardo Andrade',null,null,null,'Medellín','Antioquia',null),
      ('persona','Maria Jose Barajas Pizza',null,null,null,'Fusagasugá','Cundinamarca',null),
      ('empresa','Moon RA SAS',null,null,null,'San Andrés','San Andrés y Providencia',null),
      ('persona','Ernesto Ramirez Moncada',null,null,null,'Bogotá','Cundinamarca',null),
      ('persona','Daniel Anderson Guzman Mesa',null,null,null,'Rionegro','Antioquia',null),
      ('persona','Rene Lizarazo Lizarazo Gomez','18402697','3147905133',null,'Envigado','Antioquia','Carrera 27 #23 Sur-241, El Esmeraldal, edificio gym Smartfit')
    ) as t(tipo,nombre,doc,tel,email,ciudad,depto,direccion)
  loop
    select id into v_cli from clientes where lower(nombre) = lower(r.nombre) limit 1;
    if v_cli is null then
      insert into clientes (tipo,nombre,nit_cedula,telefono,email,ciudad_id,direccion)
      values (r.tipo, r.nombre, r.doc, r.tel, r.email,
              (select id from ciudades where nombre = r.ciudad and departamento = r.depto),
              r.direccion);
    end if;
  end loop;

  -- ---------- ÓRDENES DE PEDIDO ----------
  for r in
    select * from (values
      ('OP_WA_0017','Veronica Cristancho','B2C',false,'2026-03-07','Rack PF5 con barra Tipo M. Vendedor Yohan S.'),
      ('OP_WA_0018','Jose Pablo Montoya','B2C',true,'2026-08-11','PF5 abatible. ATRASADO POR EL CLIENTE (obra de remodelacion): fecha RE-PACTADA con el cliente para el 11-ago (la promesa original de 6-jun quedo sin efecto). Soportes de escritorio: NO incluye tabla, PEDIR PLANO A DANIEL. CON INSTALACION Y TTE. Vendedor Yohan S.'),
      ('OP_WA_0019','Carolina Alzate','B2C',true,'2026-07-10','TODO EL RACK EN BLANCO (columnas, uniones y barra). Almacenador de discos 3N: mirar render. CON INSTALACION Y TTE. YA ENTREGADO TODO MENOS LA POLEA. Vendedor Yohan S.'),
      ('OP_WA_0020','Buy Flex SAS','B2B',true,'2026-07-27','CON INSTALACION Y ENVIO. Vendedor Yohan S.'),
      ('OP_WA_0021','Henry Alexander Chaves Parra','B2C',true,'2026-07-16','Accesorio de poleas con bloques: INTEGRADO. CON INSTALACION Y TTE. ENTREGADO 22-jul salvo el sistema smith y los comercializados no resaltados. Vendedor Yohan S.'),
      ('OP_WA_0022','Casa Nua','B2B',false,'2026-07-16','Pedido de solo productos comercializados. DESPACHADO el 18-jun-2026, sin saldo pendiente. Vendedor Yohan S.'),
      ('OP_WA_0023','Elkin Yovany Perez Garcia','B2C',false,'2026-07-25','Vendedor Yohan S.'),
      ('OP_WA_0024','Juan Sebastian Quintero Osorio','B2C',false,'2026-07-31','Dos formatos en una sola OP: Rack PF5 + Pull Up System. Vendedor Yohan S.'),
      ('OP_WA_0025','Ruben Dario Londoño','B2C',false,'2026-07-31','DAP BAR todo negro. Vendedor Yohan S.'),
      ('OP_WA_0026','Hernando Abdu','B2C',true,'2026-08-03','Rack PF5 TODO NEGRO. CON INSTALACION Y TTE. Vendedor Yohan S.'),
      ('OP_WA_0027','Reactive Move SAS','B2B',false,'2026-08-08','UNA SOLA OP con los dos formatos: Rack PF10 V2.0 + Rack 3M. Poleas individuales A PARED (no al rack). Almacenador de 8 pares de mancuernas A PARED. FABRICAR CON ANTICIPACION. Nada entregado aun. Vendedor Yohan S.'),
      ('OP_WA_0028','Orlando Cuello','B2C',false,'2026-08-09','El "RACK 4M" del formato es en realidad RIG 4M PARED x2. Barras de pared, jlocks, brazos hammer, soportes sentadilla, landmines y targets en ROJO. Poleas con guias lo mas largas posible. Vendedor Yohan S.'),
      ('OP_WA_0029','Jamer Alberto Fernandez','B2C',false,'2026-08-14','CLIENTE RECOGE (sin envio ni instalacion). Uniones en NEGRO. Vendedor Yohan S.'),
      ('OP_WA_0030','Roca Business SAS','B2B',false,'2026-08-14','PF5 ABATIBLE con platinas abatibles x4. Vendedor Yohan S.'),
      ('OP_WA_0031','Ana Maria Alvarez','B2C',false,'2026-08-14','RACK SR5: columnas 2.2m (estandar, NO 2.3), uniones perforadas NEGRAS, 8 platinas triangulares (P007). Balon de 14lbs: se mando de 7kg. Vendedor Yohan S.'),
      ('OP_WA_0032','Kafury y Zukuaga SAS','B2B',false,'2026-08-15','30 dias de fabricacion. ENVIADO el 22-jul-2026. Vendedor Yohan S.'),
      ('OP_WA_0033','Urbanizacion Santa Fe','B2B',true,'2026-08-14','Rack PF5 x2 con uniones NEGRAS. CON INSTALACION Y ENVIO. Vendedor Yohan S.'),
      ('OP_WA_0034','Jorge Alonso Ayala','B2C',false,'2026-08-18','Polea con bloques para el lado derecho. Vendedor Yohan S.'),
      ('OP_WA_0035','Carlos Mario Otalvaro Giraldo','B2C',false,'2026-08-16','PF5 abatible con COLUMNA ESPECIAL DE 2.15m (confirmada por Juan, no es la estandar). CLIENTE RECOGE. Cliente cargado solo con nombre (sin datos de envio). Vendedor Yohan S.'),
      ('OP_WA_0036','Ricardo Agudelo Cardona','B2C',true,'2026-08-23','El formato decia poleas + estacion de fondos + estacion pull up: son en realidad DC Bar + polea con bloques (el DC Bar ya incluye fondos y pull up). OJO VER RENDER. CON INSTALACION Y ENVIO. Vendedor Yohan S.'),
      ('OP_WA_0037','Natalia Barrientos Clavijo','B2C',true,'2026-08-18','PF5 abatible. CON INSTALACION Y ENVIO. Vendedor Yohan S.'),
      ('OP_WA_0038','Christopher Brooks','B2C',true,'2026-08-25','Piso de caucho eco alfajor: el cliente pidio 9 LAMINAS = 2.25 m2 (1 m2 = 4 laminas). CON INSTALACION Y ENVIO. Vendedor Yohan S.'),
      ('OP_WA_0039','Nelson Ivan Rodriguez Malaver','B2C',false,'2026-08-25','SOLO ENVIO a Bogota, sin instalacion. Vendedor Yohan S.'),
      ('OP_WA_0040','Juan Raul Garzon Osorio','B2C',false,'2026-08-25','Cliente sin correo. Vendedor Yohan S.'),
      ('OP_WA_0041','Carlos Daniel Ortiz Pico','B2C',false,'2026-08-25','El formato decia "almacenador de discos horizontal 1.5m": el producto es el Carro Almacenador de Discos. Vendedor Yohan S.'),
      ('OP_WA_0042','Aider Duque','B2C',false,'2026-08-25','Pedido de almacenadores a pared (el formato trae bocetos a mano). Dos piezas son fabricacion especial, ver el detalle en cada linea. Vendedor Yohan S.'),
      ('OP_WA_0043','The Host Group SAS','B2B',false,'2026-08-25','Rack S7 con columnas de 2.3m y chazos de PISO. Almacenador de mancuernas 2N "modelo nuevo". Vendedor Yohan S.'),
      ('OP_WA_0044','Ricardo Umaña','B2C',false,'2026-08-25','Vendedor Yohan S.'),
      ('OP_WA_0045','Emilson Andres Porras Rico','B2C',false,'2026-08-25','Rack SS22 FIJO: bases PTS con 4 platinas de fijacion a piso, union xbean con 2 platinas triangulares soldadas. Vendedor Yohan S.'),
      ('OP_WA_0046','Alfonso Gonzalez','B2C',false,'2026-08-30','DC BAR con gancho TRX y mosqueton en la barra de pull up, y fondo abatible. Vendedor Yohan S.'),
      ('OP_WA_0047','Carlos Eduardo Medina Sanchez','B2C',false,'2026-08-15','UNA SOLA OP fusionando los dos formatos (25-feb y 1-jul). Columnas 2.2m: son las 2 del medio de un PF10, el cliente ya tiene 2 con barra M. NADA se ha enviado todavia (confirmado por Juan). Vendedor Yohan S.'),
      ('OP_WA_0048','Motion Nomads SAS','B2B',false,'2026-09-05','El cliente ya tiene un PF5. Vendedor Yohan S.'),
      ('OP_WA_0049','Monica Andrea Mejia Agudelo','B2C',false,'2026-09-05','Vendedor Yohan S.'),
      ('OP_WA_0050','Luis Alfonso Fajardo Andrade','B2C',false,'2026-09-05','Vendedor Yohan S.'),
      ('OP_WA_0051','Maria Jose Barajas Pizza','B2C',false,'2026-09-05','Dos formatos en una sola OP: DC BAR + Rack PF5. Vendedor Yohan S.'),
      ('OP_WA_0052','Moon RA SAS','B2B',false,'2026-09-01','VA PARA SAN ANDRES: preguntar a Yohan por la logistica. Vendedor Yohan S.'),
      ('OP_WA_0053','Ernesto Ramirez Moncada','B2C',false,'2026-08-29','Polea con bloques para el lado derecho de un Rack PF5 que el cliente ya tiene. Xbean de 50cm SIN tornilleria. Vendedor Yohan S.'),
      ('OP_WA_0054','Daniel Anderson Guzman Mesa','B2C',false,'2026-08-31','Vendedor Yohan S.'),
      ('OP_WA_0055','Rene Lizarazo Lizarazo Gomez','B2C',false,'2026-08-31','Marcado "listo completo" en el formato. ENVIADO el 22-jul-2026. Vendedor Yohan S.')
    ) as t(numero,cliente,segmento,instalacion,pactada,notas)
  loop
    insert into ordenes_pedido
      (numero, cliente_id, ciudad_id, segmento, origen_id, etapa_id,
       requiere_instalacion, fecha_entrega_pactada, vendedor_id, notas)
    select r.numero, c.id, c.ciudad_id, r.segmento, v_wa, v_cola,
           r.instalacion, r.pactada::date, v_yohan, r.notas
      from clientes c
     where lower(c.nombre) = lower(r.cliente);
  end loop;
end $$;

-- Verificación 1: deben salir 39 OPs (0017..0055).
select count(*) as ops_cargadas from ordenes_pedido
 where numero between 'OP_WA_0017' and 'OP_WA_0055';

-- Verificación 2: listado con cliente, ciudad y fecha pactada.
select o.numero, c.nombre as cliente, ci.nombre as ciudad,
       o.fecha_entrega_pactada, o.fecha_entrega_original, o.requiere_instalacion
  from ordenes_pedido o
  join clientes c  on c.id  = o.cliente_id
  left join ciudades ci on ci.id = o.ciudad_id
 where o.numero between 'OP_WA_0017' and 'OP_WA_0055'
 order by o.numero;

-- Verificación 3: CLIENTES CON DATOS INCOMPLETOS (Juan debe completarlos
-- desde Ventas → Clientes; varios formatos no traian cedula/telefono).
select c.nombre, c.nit_cedula, c.telefono, c.email, c.direccion
  from clientes c
  join ordenes_pedido o on o.cliente_id = c.id
 where o.numero between 'OP_WA_0017' and 'OP_WA_0055'
   and (c.nit_cedula is null or c.telefono is null or c.direccion is null)
 order by c.nombre;
