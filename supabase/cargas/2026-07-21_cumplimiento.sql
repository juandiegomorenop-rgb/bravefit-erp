-- ============================================================
-- NIVEL DE CUMPLIMIENTO (decisiones de Juan 21-jul-2026):
--   · "Cumplido" = entregado COMPLETO en o antes de la fecha
--     comprometida (la BD ya solo estampa fecha_entregada cuando
--     el 100% está despachado, así que esto se cumple solo).
--   · La fecha comprometida se CONGELA: se mide contra la PRIMERA
--     fecha pactada, no contra la última. Si alguien la corre para
--     no incumplir, el indicador seguiría diciendo la verdad.
--   · Cada cambio de fecha queda registrado → indicador de
--     "% de pedidos re-pactados" (¿falla la planta o la promesa?).
-- Idempotente.
-- ============================================================

alter table ordenes_pedido
  add column if not exists fecha_entrega_original date;

-- Las OPs que ya existen adoptan su fecha actual como la original
update ordenes_pedido
   set fecha_entrega_original = fecha_entrega_pactada
 where fecha_entrega_original is null
   and fecha_entrega_pactada is not null;

create table if not exists op_repactos (
  id             bigint generated always as identity primary key,
  op_id          uuid not null references ordenes_pedido(id) on delete cascade,
  fecha_anterior date,
  fecha_nueva    date,
  usuario_id     uuid references usuarios(id),
  en             timestamptz not null default now()
);
create index if not exists idx_repactos_op on op_repactos (op_id);

alter table op_repactos enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'op_repactos' and policyname = 'repactos_sel') then
    create policy repactos_sel on op_repactos for select to authenticated
      using (fn_puede('produccion','ver'));
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'op_repactos' and policyname = 'repactos_ins') then
    create policy repactos_ins on op_repactos for insert to authenticated
      with check (fn_puede('produccion','editar'));
  end if;
end $$;

-- Congela la original al crear y registra cada re-pacto posterior
create or replace function fn_congelar_fecha_entrega() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.fecha_entrega_original is null then
      new.fecha_entrega_original := new.fecha_entrega_pactada;
    end if;
    return new;
  end if;

  -- La original NUNCA se reescribe: solo se rellena si venía nula
  if new.fecha_entrega_original is distinct from old.fecha_entrega_original
     and old.fecha_entrega_original is not null then
    new.fecha_entrega_original := old.fecha_entrega_original;
  end if;
  if new.fecha_entrega_original is null then
    new.fecha_entrega_original := coalesce(
      old.fecha_entrega_original, old.fecha_entrega_pactada, new.fecha_entrega_pactada);
  end if;

  if new.fecha_entrega_pactada is distinct from old.fecha_entrega_pactada then
    insert into op_repactos (op_id, fecha_anterior, fecha_nueva, usuario_id)
    values (new.id, old.fecha_entrega_pactada, new.fecha_entrega_pactada, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_congelar_fecha_entrega on ordenes_pedido;
create trigger trg_congelar_fecha_entrega
  before insert or update on ordenes_pedido
  for each row execute function fn_congelar_fecha_entrega();

-- Verificación: original = pactada en todas (aún no hay re-pactos)
select count(*) filter (where fecha_entrega_original is not null) as con_original,
       count(*) filter (where fecha_entrega_original is distinct from fecha_entrega_pactada)
         as repactadas,
       count(*) as total
  from ordenes_pedido where activo;
