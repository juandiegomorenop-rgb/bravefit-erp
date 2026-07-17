-- CARGA 15 OPs BACKLOG (17-jul-2026) — clientes + ordenes + items fabricados
-- Origen planner (OP_BFP_####), etapa En Cola (no descuenta MP aun),
-- fecha entrega = envio + 15 dias. Comercializados van en notas. Idempotente por guardia.

insert into ciudades (nombre, departamento) values ('Facatativá','Cundinamarca'),('Tuluá','Valle del Cauca'),('Sincelejo','Sucre'),('Puebloviejo','Magdalena'),('Pitalito','Huila') on conflict (nombre, departamento) do nothing;

do $$
declare v_cli uuid; v_op uuid; v_planner smallint; v_cola smallint;
begin
  if exists (select 1 from ordenes_pedido where numero like 'OP_BFP_%') then
    raise notice 'Las OPs OP_BFP ya estan cargadas; no se repiten.'; return;
  end if;
  select id into v_planner from origenes_op where clave='planner';
  select id into v_cola from etapas_produccion where nombre='En Cola';

  -- OP_BFP_0001 · David Freyre
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','David Freyre',null,null,(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'El Poblado') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0001',v_cli,(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'B2C',v_planner,v_cola,true,'2026-07-27','Incluye ademas: piso de caucho 9m2, agarres (tobillo/espalda/lazo), mueble mixto 0.9x1.5x0.45m, almacenador de fitball. CON INSTALACION Y ENVIO. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5f',1),('3Fond',1),('8TaAlmAgPo',1),('3PoMov',1),('8AlmFond',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0002 · Diana Marcela Gomez Rivera
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Diana Marcela Gomez Rivera','1037638718','3219308410',(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'Cra 32 #38A sur 28, barrio Mesa') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0002',v_cli,(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'B2C',v_planner,v_cola,true,'2026-07-25','Incluye ademas: agarres (lazo/tobillo/individual/espalda), rollos rack pad, almacenador de discos 3N, kit bandas de poder. CON INSTALACION Y ENVIO. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5f',1),('3PoMov',1),('3SmithCmov',1),('8PortBaPa3',1),('8TaAlmAgPo',1),('3RaPa',1),('8MuManN313',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0003 · Diego Alejandro Sanchez Sanchez
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Diego Alejandro Sanchez Sanchez','43221935','3195988142',(select id from ciudades where nombre='Facatativá' and departamento='Cundinamarca'),'Calle 16 #10-20 Torre 5 apto 704, conj. Azaleas') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0003',v_cli,(select id from ciudades where nombre='Facatativá' and departamento='Cundinamarca'),'B2C',v_planner,v_cola,false,'2026-07-16','Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5f',1),('3ADR',2)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0004 · Diego Julian Ospina Castillo
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Diego Julian Ospina Castillo','94325868','3108257399',(select id from ciudades where nombre='Tuluá' and departamento='Valle del Cauca'),'Cra 35a #19-76') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0004',v_cli,(select id from ciudades where nombre='Tuluá' and departamento='Valle del Cauca'),'B2C',v_planner,v_cola,false,'2026-07-31','Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('6BaPle',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0005 · Fidel Manuel Barrio Zarate
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Fidel Manuel Barrio Zarate','1143374612','3011821879',(select id from ciudades where nombre='Envigado' and departamento='Antioquia'),'Carrera 32 #39 sur 73') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0005',v_cli,(select id from ciudades where nombre='Envigado' and departamento='Antioquia'),'B2C',v_planner,v_cola,false,'2026-07-31','Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5f',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0006 · Habitare espacios SAS
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('empresa','Habitare espacios SAS','901532589','3002683632',(select id from ciudades where nombre='Cali' and departamento='Valle del Cauca'),'Cra 24F #3 oeste-46') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0006',v_cli,(select id from ciudades where nombre='Cali' and departamento='Valle del Cauca'),'B2B',v_planner,v_cola,true,'2026-07-13','Incluye ademas: discos encauchetados 5/10/15/25/35/45 lbs (~2 c/u). INCLUYE INSTALACION Y ENVIO. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaS15',1),('6BaPle',1),('3Fond',1),('3ADR',2)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0007 · Hector Andres Acosta Perez
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Hector Andres Acosta Perez','1233493499','3123669536',(select id from ciudades where nombre='Bogotá' and departamento='Cundinamarca'),'Carrera 77j No 65a-10 Sur, Estacion') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0007',v_cli,(select id from ciudades where nombre='Bogotá' and departamento='Cundinamarca'),'B2C',v_planner,v_cola,false,'2026-07-12','Incluye ademas: discos 35lbs x2, discos 45lbs x2. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF10V2',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0008 · Juan Carlos Rodriguez Santos
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Juan Carlos Rodriguez Santos','1118283860','3173630223',(select id from ciudades where nombre='Cali' and departamento='Valle del Cauca'),'Calle 5 Oeste #29-44, Tejares de Cristales') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0008',v_cli,(select id from ciudades where nombre='Cali' and departamento='Valle del Cauca'),'B2C',v_planner,v_cola,true,'2026-07-25','Incluye ademas: agarres (espalda/lazo/individual), barra olimpica cromada 15kg, discos 15/25/45 lbs, piso de caucho Sponch. Alm. agarres con 10 ganchos. CON INSTALACION Y ENVIO. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5f',1),('3PoMov',1),('3SmithCmov',1),('3PoRa2',1),('3Fond',1),('3Land',1),('8aldipa3',1),('6BaPle',1),('8TaAlmAgPo',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0009 · Juan Pablo Valbuena Anaya
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Juan Pablo Valbuena Anaya','73130737','3106571038',(select id from ciudades where nombre='Cartagena' and departamento='Bolívar'),'Barcelona de Indias Mz 2 Lt 1, etapa Gaudi, zona norte') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0009',v_cli,(select id from ciudades where nombre='Cartagena' and departamento='Bolívar'),'B2C',v_planner,v_cola,false,'2026-07-16','Incluye ademas: barras olimpicas negras 15/20kg, agarres varios, mancuernas hex 5-45kg, discos 10/15/25/35 lbs. Parte de implementos ya DESPACHADOS (resaltados). Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaS15',1),('3PoMov',2),('3Land',1),('3RaPa',1),('6BaPle',1),('3LeRo',1),('5HQRo',1),('8aldipa3',1),('8MuManN3200',1),('3EsAb',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0010 · Julian Fernando Mejia Nino
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Julian Fernando Mejia Nino','1144065306','3150524993',(select id from ciudades where nombre='Sincelejo' and departamento='Sucre'),'Carrera 50 #27-285, Edif. Ambar apto 301, Venecia') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0010',v_cli,(select id from ciudades where nombre='Sincelejo' and departamento='Sucre'),'B2C',v_planner,v_cola,false,'2026-07-25','DC Bar con gancho soldado arriba en la barra de pull up (para colgar TRX). Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('7DcBar',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0011 · Kevin Criollo
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Kevin Criollo','1018446174','3203973663',(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'C 25 #10-117, urb. La Sierra casa 108') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0011',v_cli,(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'B2C',v_planner,v_cola,false,'2026-07-27','PF5 abatible tipo Andres Bernal (para tener bloques). Incluye ademas: barra olimpica negra 15kg, discos 10lbs x4 y 15lbs x4, agarres (individual/tobillo/espalda/lazo). Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5p',1),('3PoMov',1),('3PoRa2',1),('6BaPle',1),('3Land',1),('8TaAlmAgPo',1),('8aldipa3',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0012 · Leonardo Fabio Duran Varela
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Leonardo Fabio Duran Varela','85153859','3028331427',(select id from ciudades where nombre='Puebloviejo' and departamento='Magdalena'),'Calle 7 #8-20') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0012',v_cli,(select id from ciudades where nombre='Puebloviejo' and departamento='Magdalena'),'B2C',v_planner,v_cola,false,'2026-07-16','PF5 abatible. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5p',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0013 · Maria Fernanda (Angolu)
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('empresa','Maria Fernanda (Angolu)','901446776','3113791438',(select id from ciudades where nombre='Envigado' and departamento='Antioquia'),'Pedir ubicacion a Yohan') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0013',v_cli,(select id from ciudades where nombre='Envigado' and departamento='Antioquia'),'B2B',v_planner,v_cola,true,'2026-07-21','Traslado de rack y tula de 2do a 3er piso (ya tiene PF5 fijo; subir sistemas y traer lo que sobre del sistema viejo de bloques negros). Incluye instalacion y transporte. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('3PoMov',2)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0014 · Natali Uribe Acosta
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Natali Uribe Acosta',null,'3176465398',(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'Calle 51 B #81 A 54, barrio Calasanz') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0014',v_cli,(select id from ciudades where nombre='Medellín' and departamento='Antioquia'),'B2C',v_planner,v_cola,false,'2026-07-13','Incluye ademas: barra crossfit semiprofesional 2m, discos 20kg x2, discos 10kg x2. Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('1RaPF5f',1),('3PoMov',1)) x(sku,cant) join productos p on p.sku=x.sku;

  -- OP_BFP_0015 · Sebastian Perez Morales
  insert into clientes (tipo,nombre,nit_cedula,telefono,ciudad_id,direccion)
    values ('persona','Sebastian Perez Morales','1053815382','3123335521',(select id from ciudades where nombre='Pitalito' and departamento='Huila'),'Carrera 1 numero 6-26') returning id into v_cli;
  insert into ordenes_pedido (numero,cliente_id,ciudad_id,segmento,origen_id,etapa_id,requiere_instalacion,fecha_entrega_pactada,notas)
    values ('OP_BFP_0015',v_cli,(select id from ciudades where nombre='Pitalito' and departamento='Huila'),'B2C',v_planner,v_cola,false,'2026-07-14','Tiene un rack S15. Incluye ademas: barra olimpica negra 20kg, discos 15/25/35 lbs (~2 c/u). Vendedor Yohan S.') returning id into v_op;
  insert into op_items (op_id,producto_id,cantidad,precio_unit)
    select v_op,p.id,x.cant,p.precio_lista from (values ('3PoMov',1),('8aldipa2',1)) x(sku,cant) join productos p on p.sku=x.sku;
end $$;

-- Verificacion
select o.numero, cl.nombre cliente, ci.nombre ciudad, o.fecha_entrega_pactada entrega,
       count(oi.id) items_fab
  from ordenes_pedido o join clientes cl on cl.id=o.cliente_id
  left join ciudades ci on ci.id=o.ciudad_id
  left join op_items oi on oi.op_id=o.id
  where o.numero like 'OP_BFP_%' group by 1,2,3,4 order by o.numero;