-- =========================================================
-- finanzas-py — Reglas de vigencia y monto por plantilla
--
-- Permite dos cosas sobre una misma plantilla:
--   1) VIGENCIA: que no aplique en cierto rango de períodos
--      (ej: colegio, que no se paga en diciembre y enero).
--   2) MONTO: que valga un importe distinto a partir de cierto período
--      (ej: aumento de sueldo desde enero), sin perder el monto actual
--      que se sigue usando para los períodos anteriores.
--
-- La plantilla conserva su monto base. Las reglas lo sobrescriben SOLO
-- dentro del rango indicado. Si un período no cae en ninguna regla, vale
-- lo que dice la plantilla.
-- =========================================================

create table if not exists finanzas_py.template_rules (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,

  -- A qué plantilla aplica. Solo una de las dos columnas va cargada.
  expense_template_id uuid references finanzas_py.expense_templates(id) on delete cascade,
  income_template_id uuid references finanzas_py.income_templates(id) on delete cascade,

  -- Rango de vigencia, en inicios de ciclo (día 27). hasta_periodo null =
  -- "de acá en adelante, sin fecha de fin".
  desde_periodo date not null,
  hasta_periodo date,

  -- true  = aplica (opcionalmente con monto distinto)
  -- false = no aplica en este rango (el gasto/ingreso se omite)
  aplica boolean not null default true,

  -- Monto que rige en el rango. null = usar el monto de la plantilla.
  monto numeric(14,2),

  nota text,
  created_at timestamptz not null default now(),

  -- Exactamente una de las dos referencias tiene que estar cargada.
  constraint una_plantilla check (
    (expense_template_id is not null and income_template_id is null) or
    (expense_template_id is null and income_template_id is not null)
  ),
  constraint rango_valido check (hasta_periodo is null or hasta_periodo >= desde_periodo)
);

create index if not exists idx_template_rules_gasto
  on finanzas_py.template_rules(expense_template_id, desde_periodo);
create index if not exists idx_template_rules_ingreso
  on finanzas_py.template_rules(income_template_id, desde_periodo);

alter table finanzas_py.template_rules enable row level security;

create policy "crud template_rules" on finanzas_py.template_rules
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

grant all on finanzas_py.template_rules to anon, authenticated, service_role;
