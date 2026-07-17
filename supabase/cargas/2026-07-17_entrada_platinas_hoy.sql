-- ============================================================
-- ENTRADA DE PLATINAS RECIBIDAS 17-jul-2026
-- Registradas como 'ajuste' (positivo) porque entrada_compra exige
-- costo_unit y aun no hay factura. Cuando llegue la factura se registra
-- el COSTO, NO la cantidad otra vez (evita duplicar).
-- Idempotente: no re-inserta si ya existe el movimiento con esta nota.
-- ============================================================
do $$
declare v_user uuid; v_ex uuid; r record;
  v_nota constant text := 'Entrada recibida 17-jul-2026 (compra, costo pendiente de factura)';
begin
  select id into strict v_user from usuarios where email='juanmoreno@bravefit.co';
  for r in select * from (values
    ('P005',40),('P029',8),('P030',136),('P061',36),
    ('P036',8),('P037',8),('P038',8),('P039',8),('P040',8),('P041',16),('P042',16)
  ) as t(cod,cant)
  loop
    select e.id into strict v_ex from existencias e
      join materiales m on m.id=e.material_id
     where m.nombre like r.cod||' ·%' and e.tipo='materia_prima';
    if not exists (select 1 from movimientos_inventario
                   where existencia_id=v_ex and tipo='ajuste' and nota=v_nota) then
      insert into movimientos_inventario (existencia_id,tipo,cantidad,usuario_id,nota)
      values (v_ex,'ajuste',r.cant,v_user,v_nota);
    end if;
  end loop;
end $$;

select m.nombre, e.cantidad_disponible from materiales m
 join existencias e on e.material_id=m.id and e.tipo='materia_prima'
 where m.nombre like any (array['P005 ·%','P029 ·%','P030 ·%','P061 ·%','P036 ·%','P037 ·%','P038 ·%','P039 ·%','P040 ·%','P041 ·%','P042 ·%'])
 order by m.nombre;
