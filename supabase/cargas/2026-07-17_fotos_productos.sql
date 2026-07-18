-- FOTOS DE PRODUCTOS desde carpeta Intuix (17-jul-2026)
-- Solo pisa productos SIN imagen (no toca las URLs de Shopify existentes).
update productos p set imagen_url = v.url
from (values
  ('1RaP20','/productos/1rap20.png'),
  ('2RiPa10m','/productos/2ripa10m.jpg'),
  ('2RiPa12m','/productos/2ripa12m.jpg'),
  ('2RiPa4m','/productos/2ripa4m.jpg'),
  ('2RiPa6m','/productos/2ripa6m.jpg'),
  ('2RiPa7m','/productos/2ripa7m.jpg'),
  ('2RiPa9m','/productos/2ripa9m.jpg'),
  ('2RiPi10m','/productos/2ripi10m.jpg'),
  ('2RiPi12m','/productos/2ripi12m.jpg'),
  ('2RiPi4m','/productos/2ripi4m.jpg'),
  ('2RiPi6m','/productos/2ripi6m.jpg'),
  ('2RiPi7m','/productos/2ripi7m.jpg'),
  ('2RiPi9m','/productos/2ripi9m.jpg'),
  ('3AgIndivid','/productos/3agindivid.jpg'),
  ('3AgPulUp','/productos/3agpulup.jpg'),
  ('3AgTob','/productos/3agtob.jpg'),
  ('3BaMe','/productos/3bame.png'),
  ('3GaAL','/productos/3gaal.png'),
  ('3JLo','/productos/3jlo.png'),
  ('3PoMov','/productos/3pomov.jpg'),
  ('3SmithTr','/productos/3smithtr.jpg'),
  ('3TargAl','/productos/3targal.png'),
  ('5HQRo','/productos/5hqro.png'),
  ('7CaMaMe','/productos/7camame.jpg'),
  ('8AlmEl5pos','/productos/8almel5pos.png'),
  ('8ArAlmDisN3','/productos/8aralmdisn3.jpg'),
  ('8PisCauSpon','/productos/8piscauspon.jpg'),
  ('8PortBaPa5','/productos/8portbapa5.jpg'),
  ('8TaAlmAgPo','/productos/8taalmagpo.jpg')
) as v(sku,url)
where p.sku = v.sku and (p.imagen_url is null or p.imagen_url = '');

select count(*) as con_foto from productos where imagen_url is not null and imagen_url <> '';