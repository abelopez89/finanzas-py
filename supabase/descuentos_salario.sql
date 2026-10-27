-- =========================================================
-- finanzas-py · Descuentos de salario
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: se puede correr de nuevo sin romper nada.
--
-- Módulo de registro y recordatorio de lo que se paga con el salario
-- ANTES de transferir al fondo mutuo (cuotas de préstamos y la propia
-- transferencia al fondo). A propósito NO se relaciona con
-- fund_movements, income_entries ni expense_entries: es un registro
-- aparte que no altera el saldo del fondo, las previsiones ni el
-- extracto mensual.
-- =========================================================

-- ---------------------------------------------------------
-- 1) FUENTES DE SALARIO
--
-- titular_user_id es solo una etiqueta ("de quién es este salario"):
-- todos los usuarios de la cuenta ven y editan todo. Apunta a
-- finanzas_py.account_users(id) y no a auth.users, para no depender
-- del esquema auth (compartido con otras apps).
-- ---------------------------------------------------------
create table if not exists finanzas_py.salary_sources (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  nombre text not null,
  titular_user_id uuid references finanzas_py.account_users(id) on delete set null,
  dia_cobro integer not null check (dia_cobro between 1 and 31),
  monto_bruto numeric(14,2) not null default 0,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_sources_account
  on finanzas_py.salary_sources(account_id);

-- ---------------------------------------------------------
-- 2) CONCEPTOS QUE SE DESCUENTAN DE CADA SALARIO
--
-- cuotas_total null = sin fin definido (ej. la transferencia al fondo).
-- cuotas_pagadas_inicial: para préstamos que ya venían corriendo antes
-- de empezar a usar este módulo.
-- ---------------------------------------------------------
create table if not exists finanzas_py.salary_deductions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  salary_source_id uuid not null references finanzas_py.salary_sources(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('prestamo', 'transferencia_fondo', 'otro')),
  monto_cuota numeric(14,2) not null default 0,
  cuotas_total integer check (cuotas_total is null or cuotas_total > 0),
  cuotas_pagadas_inicial integer not null default 0 check (cuotas_pagadas_inicial >= 0),
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_deductions_source
  on finanzas_py.salary_deductions(salary_source_id);
create index if not exists idx_salary_deductions_account
  on finanzas_py.salary_deductions(account_id);

-- ---------------------------------------------------------
-- 3) REGISTRO POR PERÍODO (pagado u omitido)
--
-- Un solo registro por concepto y período: lo pendiente se calcula al
-- vuelo como "concepto activo sin registro en el período", así que un
-- segundo registro no tendría significado. Un adelanto de cuotas se
-- anota en el mismo registro con cuotas_cubiertas > 1.
-- created_by guarda auth.uid() de quien registró, sin FK al esquema auth.
-- ---------------------------------------------------------
create table if not exists finanzas_py.salary_deduction_payments (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  salary_deduction_id uuid not null references finanzas_py.salary_deductions(id) on delete cascade,
  -- Inicio del ciclo (día 27), igual que expense_entries.periodo
  periodo date not null,
  monto numeric(14,2) not null default 0,
  cuotas_cubiertas integer not null default 1 check (cuotas_cubiertas >= 0),
  estado text not null check (estado in ('pagado', 'omitido')),
  fecha_pago date,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (salary_deduction_id, periodo)
);

create index if not exists idx_salary_deduction_payments_periodo
  on finanzas_py.salary_deduction_payments(account_id, periodo);

-- ---------------------------------------------------------
-- 4) RLS: mismo patrón que el resto de las tablas de la cuenta
-- ---------------------------------------------------------
alter table finanzas_py.salary_sources enable row level security;
alter table finanzas_py.salary_deductions enable row level security;
alter table finanzas_py.salary_deduction_payments enable row level security;

drop policy if exists "crud salary_sources" on finanzas_py.salary_sources;
create policy "crud salary_sources" on finanzas_py.salary_sources
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

drop policy if exists "crud salary_deductions" on finanzas_py.salary_deductions;
create policy "crud salary_deductions" on finanzas_py.salary_deductions
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

drop policy if exists "crud salary_deduction_payments" on finanzas_py.salary_deduction_payments;
create policy "crud salary_deduction_payments" on finanzas_py.salary_deduction_payments
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

-- ---------------------------------------------------------
-- 5) Permisos
-- ---------------------------------------------------------
grant all on finanzas_py.salary_sources to anon, authenticated, service_role;
grant all on finanzas_py.salary_deductions to anon, authenticated, service_role;
grant all on finanzas_py.salary_deduction_payments to anon, authenticated, service_role;
