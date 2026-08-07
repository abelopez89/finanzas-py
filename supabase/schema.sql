-- =========================================================
-- finanzas-py - Schema inicial (Etapa 1)
-- Pensado para convivir en un proyecto Supabase compartido
-- con otras apps (ej. vacamanager, irp-py): todo vive en el
-- esquema "finanzas_py", NUNCA en "public".
-- Ejecutar en el SQL Editor de Supabase.
-- =========================================================

create schema if not exists finanzas_py;

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------
-- CUENTA FAMILIAR (agrupa a todos los correos/usuarios vinculados)
-- -----------------------------------------------------------------
create table finanzas_py.accounts (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null default 'Familia',
  created_at timestamptz not null default now()
);

-- Usuarios (correos Gmail) vinculados a una cuenta.
-- auth_user_id apunta a auth.users.id (Supabase Auth, esquema compartido
-- por todo el proyecto). Cuando se hace linkIdentity, sigue siendo el
-- mismo auth_user_id, por lo que un solo registro cubre ambos correos.
create table finanzas_py.account_users (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  auth_user_id uuid not null,
  email text not null,
  nombre text,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

-- -----------------------------------------------------------------
-- CONFIGURACION: métodos de pago y categorías
-- -----------------------------------------------------------------
create table finanzas_py.payment_methods (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table finanzas_py.categories (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- DESTINATARIOS DE TELEGRAM
-- -----------------------------------------------------------------
create table finanzas_py.telegram_recipients (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  nombre text not null,
  chat_id text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- PLANTILLAS DE GASTOS E INGRESOS MENSUALES
-- -----------------------------------------------------------------
create table finanzas_py.expense_templates (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  nombre text not null,
  dia_mes integer not null check (dia_mes between 1 and 31),
  monto numeric(14,2) not null default 0,
  payment_method_id uuid references finanzas_py.payment_methods(id),
  category_id uuid references finanzas_py.categories(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table finanzas_py.income_templates (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  nombre text not null,
  dia_mes integer not null check (dia_mes between 1 and 31),
  monto numeric(14,2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- APLICACIONES MENSUALES (movimientos reales, ligados o no a plantilla)
-- "periodo" = fecha de inicio del ciclo de facturación (día 27) al que
-- pertenece el movimiento, respetando el ciclo 27-26.
-- -----------------------------------------------------------------
create table finanzas_py.expense_entries (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  template_id uuid references finanzas_py.expense_templates(id),
  es_extra boolean not null default false,
  nombre text not null,
  periodo date not null,
  dia integer not null check (dia between 1 and 31),
  monto numeric(14,2) not null default 0,
  payment_method_id uuid references finanzas_py.payment_methods(id),
  category_id uuid references finanzas_py.categories(id),
  fecha_vencimiento date,               -- usado principalmente por extras
  estado text not null default 'pendiente'
    check (estado in ('pendiente','rescatado','pagado')),
  fecha_pago date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table finanzas_py.income_entries (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  template_id uuid references finanzas_py.income_templates(id),
  es_extra boolean not null default false,
  nombre text not null,
  periodo date not null,
  dia integer not null check (dia between 1 and 31),
  monto numeric(14,2) not null default 0,
  fecha_aplicacion date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- FONDO MUTUO: saldo inicial, controles de saldo (para inferir interés)
-- y libro mayor de movimientos confirmados
-- -----------------------------------------------------------------
create table finanzas_py.fund_initial_balance (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null unique references finanzas_py.accounts(id) on delete cascade,
  monto numeric(14,2) not null,
  fecha date not null,
  created_at timestamptz not null default now()
);

-- Cada vez que el usuario ingresa el saldo actual del fondo (leído de su
-- app/banco), se calcula la diferencia contra el saldo esperado por el
-- sistema y esa diferencia se registra como interés.
create table finanzas_py.fund_balance_checks (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  fecha date not null,
  monto_informado numeric(14,2) not null,
  saldo_esperado_sistema numeric(14,2) not null,
  interes_calculado numeric(14,2) not null,
  created_at timestamptz not null default now()
);

-- Libro mayor: todo movimiento confirmado que impacta el saldo del fondo.
-- tipo: ingreso | egreso | interes | saldo_inicial
create table finanzas_py.fund_movements (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','egreso','interes','saldo_inicial')),
  monto numeric(14,2) not null,
  fecha date not null,
  referencia_tipo text,
  referencia_id uuid,
  descripcion text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- Índices útiles
-- -----------------------------------------------------------------
create index idx_expense_entries_periodo on finanzas_py.expense_entries(account_id, periodo);
create index idx_income_entries_periodo on finanzas_py.income_entries(account_id, periodo);
create index idx_fund_movements_fecha on finanzas_py.fund_movements(account_id, fecha);
create index idx_expense_entries_vencimiento on finanzas_py.expense_entries(fecha_vencimiento) where fecha_vencimiento is not null;

-- -----------------------------------------------------------------
-- Row Level Security: cada usuario solo ve datos de su(s) cuenta(s)
-- -----------------------------------------------------------------
alter table finanzas_py.accounts enable row level security;
alter table finanzas_py.account_users enable row level security;
alter table finanzas_py.payment_methods enable row level security;
alter table finanzas_py.categories enable row level security;
alter table finanzas_py.telegram_recipients enable row level security;
alter table finanzas_py.expense_templates enable row level security;
alter table finanzas_py.income_templates enable row level security;
alter table finanzas_py.expense_entries enable row level security;
alter table finanzas_py.income_entries enable row level security;
alter table finanzas_py.fund_initial_balance enable row level security;
alter table finanzas_py.fund_balance_checks enable row level security;
alter table finanzas_py.fund_movements enable row level security;

-- Función helper: cuentas a las que pertenece el usuario autenticado
create or replace function finanzas_py.auth_account_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select account_id from finanzas_py.account_users where auth_user_id = auth.uid();
$$;

create policy "select own account" on finanzas_py.accounts
  for select using (id in (select finanzas_py.auth_account_ids()));

create policy "insert own account" on finanzas_py.accounts
  for insert to authenticated
  with check (true);

create policy "select own account_users" on finanzas_py.account_users
  for select using (account_id in (select finanzas_py.auth_account_ids()));

create policy "insert own account_users" on finanzas_py.account_users
  for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy "update own account_users" on finanzas_py.account_users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "crud payment_methods" on finanzas_py.payment_methods
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud categories" on finanzas_py.categories
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud telegram_recipients" on finanzas_py.telegram_recipients
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud expense_templates" on finanzas_py.expense_templates
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud income_templates" on finanzas_py.income_templates
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud expense_entries" on finanzas_py.expense_entries
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud income_entries" on finanzas_py.income_entries
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud fund_initial_balance" on finanzas_py.fund_initial_balance
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud fund_balance_checks" on finanzas_py.fund_balance_checks
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

create policy "crud fund_movements" on finanzas_py.fund_movements
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

-- -----------------------------------------------------------------
-- IMPORTANTE: exponer el esquema en la API de Supabase
-- Dashboard > Project Settings > API > Exposed schemas
-- Agregar "finanzas_py" a la lista (junto a "public", sin sacarlo).
-- Sin este paso, el cliente de Supabase no va a poder leer estas tablas.
-- -----------------------------------------------------------------

-- -----------------------------------------------------------------
-- Otorgar permisos de uso del esquema a los roles estándar de Supabase
-- (necesario porque el esquema es nuevo, no viene con permisos por defecto)
-- -----------------------------------------------------------------
grant usage on schema finanzas_py to anon, authenticated, service_role;
grant all on all tables in schema finanzas_py to anon, authenticated, service_role;
grant all on all sequences in schema finanzas_py to anon, authenticated, service_role;
alter default privileges in schema finanzas_py grant all on tables to anon, authenticated, service_role;
alter default privileges in schema finanzas_py grant all on sequences to anon, authenticated, service_role;
