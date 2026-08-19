-- =========================================================
-- finanzas-py — Vigencias de plantillas
--
-- Permite que una plantilla cambie de monto o deje de aplicar a partir de
-- un período determinado, sin perder el valor anterior.
--
-- Modelo: una línea de tiempo de reglas por plantilla. Cada regla dice
-- "desde este período (inicio de ciclo, día 27), esta plantilla está
-- activa/inactiva y vale este monto". Para un período dado se aplica la
-- ÚLTIMA regla cuyo desde_periodo <= período; si no hay ninguna, se usan
-- los valores propios de la plantilla.
--
-- Ejemplos:
--   Colegio feb-nov 2027:
--     desde 2027-01-27 (feb '27) → activo, 2.673.000
--     desde 2027-11-27 (dic '27) → inactivo
--   Aumento de sueldo desde enero '27:
--     desde 2026-12-27 (ene '27) → activo, 27.500.000
-- =========================================================

create table finanzas_py.expense_template_vigencias (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  template_id uuid not null references finanzas_py.expense_templates(id) on delete cascade,
  -- Inicio del ciclo (día 27) desde el cual aplica esta regla
  desde_periodo date not null,
  activo boolean not null default true,
  -- Si es null, se mantiene el monto que ya venía rigiendo
  monto numeric(14,2),
  nota text,
  created_at timestamptz not null default now(),
  unique (template_id, desde_periodo)
);

create table finanzas_py.income_template_vigencias (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  template_id uuid not null references finanzas_py.income_templates(id) on delete cascade,
  desde_periodo date not null,
  activo boolean not null default true,
  monto numeric(14,2),
  nota text,
  created_at timestamptz not null default now(),
  unique (template_id, desde_periodo)
);

create index idx_exp_vig_template on finanzas_py.expense_template_vigencias(template_id, desde_periodo);
create index idx_inc_vig_template on finanzas_py.income_template_vigencias(template_id, desde_periodo);

-- -----------------------------------------------------------------
-- RLS: mismas políticas que el resto de las tablas de la cuenta
-- -----------------------------------------------------------------
alter table finanzas_py.expense_template_vigencias enable row level security;
alter table finanzas_py.income_template_vigencias enable row level security;

create policy "crud expense_template_vigencias" on finanzas_py.expense_template_vigencias
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud income_template_vigencias" on finanzas_py.income_template_vigencias
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

grant all on finanzas_py.expense_template_vigencias to anon, authenticated, service_role;
grant all on finanzas_py.income_template_vigencias to anon, authenticated, service_role;
