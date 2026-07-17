-- ============================================================
-- RENOMBRES DE PLATINAS — decisión de Juan 17-jul-2026
-- Los nombres nuevos reflejan el uso real en producción:
--   P027: en X guía en columna      → Platina en X carro móvil
--   P028: en C para guía en X       → Platina en C carro móvil
--   P061: doble tapa polea          → Platina doble polea
-- El código no cambia, solo el nombre (el kardex e historial siguen intactos).
-- Idempotente.
-- ============================================================

update materiales set nombre = 'P027 · Platina en X carro móvil'  where nombre like 'P027 ·%';
update materiales set nombre = 'P028 · Platina en C carro móvil'  where nombre like 'P028 ·%';
update materiales set nombre = 'P061 · Platina doble polea'       where nombre like 'P061 ·%';

-- Verificación: deben salir los 3 nombres nuevos.
select nombre from materiales
 where nombre like 'P027%' or nombre like 'P028%' or nombre like 'P061%'
 order by nombre;
