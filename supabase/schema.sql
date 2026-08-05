-- =========================================================
-- LJ Finanzas - Schema inicial (Etapa 1)
-- Ejecutar en el SQL Editor de Supabase
-- =========================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------
-- CUENTA FAMILIAR (agrupa a todos los correos/usuarios vinculados)
-- -----------------------------------------------------------------
create table accounts (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null default 'Familia',
  created_at timestamptz not null default now()
);

-- Usuarios (correos Gmail) vinculados a una cuenta.
-- auth_user_id apunta a auth.users.id (Supabase Auth).
-- Cuando se hace linkIdentity, sigue siendo el mismo auth_user_id,
-- por lo que en la práctica un solo registro cubre ambos correos.
-- Este registro extra permite, igualmente, llevar nombre visible por persona.
create table account_users (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
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
create table payment_methods (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- DESTINATARIOS DE TELEGRAM
-- -----------------------------------------------------------------
create table telegram_recipients (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  nombre text not null,
  chat_id text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- PLANTILLAS DE GASTOS E INGRESOS MENSUALES
-- -----------------------------------------------------------------
create table expense_templates (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  nombre text not null,
  dia_mes integer not null check (dia_mes between 1 and 31),
  monto numeric(14,2) not null default 0,
  payment_method_id uuid references payment_methods(id),
  category_id uuid references categories(id),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table income_templates (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
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
create table expense_entries (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  template_id uuid references expense_templates(id),
  es_extra boolean not null default false,
  nombre text not null,
  periodo date not null,
  dia integer not null check (dia between 1 and 31),
  monto numeric(14,2) not null default 0,
  payment_method_id uuid references payment_methods(id),
  category_id uuid references categories(id),
  fecha_vencimiento date,               -- usado principalmente por extras
  estado text not null default 'pendiente'
    check (estado in ('pendiente','rescatado','pagado')),
  fecha_pago date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table income_entries (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  template_id uuid references income_templates(id),
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
create table fund_initial_balance (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null unique references accounts(id) on delete cascade,
  monto numeric(14,2) not null,
  fecha date not null,
  created_at timestamptz not null default now()
);

-- Cada vez que el usuario ingresa el saldo actual del fondo (leído de su
-- app/banco), se calcula la diferencia contra el saldo esperado por el
-- sistema y esa diferencia se registra como interés.
create table fund_balance_checks (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  fecha date not null,
  monto_informado numeric(14,2) not null,   -- saldo real informado por el usuario
  saldo_esperado_sistema numeric(14,2) not null, -- saldo calculado por la app antes del ajuste
  interes_calculado numeric(14,2) not null, -- monto_informado - saldo_esperado_sistema
  created_at timestamptz not null default now()
);

-- Libro mayor: todo movimiento confirmado que impacta el saldo del fondo.
-- tipo: ingreso | egreso | interes | saldo_inicial
create table fund_movements (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','egreso','interes','saldo_inicial')),
  monto numeric(14,2) not null,       -- siempre positivo; el signo lo da "tipo"
  fecha date not null,
  referencia_tipo text,               -- 'expense_entries' | 'income_entries' | null
  referencia_id uuid,
  descripcion text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- Índices útiles
-- -----------------------------------------------------------------
create index idx_expense_entries_periodo on expense_entries(account_id, periodo);
create index idx_income_entries_periodo on income_entries(account_id, periodo);
create index idx_fund_movements_fecha on fund_movements(account_id, fecha);
create index idx_expense_entries_vencimiento on expense_entries(fecha_vencimiento) where fecha_vencimiento is not null;

-- -----------------------------------------------------------------
-- Row Level Security: cada usuario solo ve datos de su(s) cuenta(s)
-- -----------------------------------------------------------------
alter table accounts enable row level security;
alter table account_users enable row level security;
alter table payment_methods enable row level security;
alter table categories enable row level security;
alter table telegram_recipients enable row level security;
alter table expense_templates enable row level security;
alter table income_templates enable row level security;
alter table expense_entries enable row level security;
alter table income_entries enable row level security;
alter table fund_initial_balance enable row level security;
alter table fund_balance_checks enable row level security;
alter table fund_movements enable row level security;

-- Función helper: cuentas a las que pertenece el usuario autenticado
create or replace function auth_account_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select account_id from account_users where auth_user_id = auth.uid();
$$;

-- Política genérica reutilizada en todas las tablas con account_id
create policy "select own account" on accounts
  for select using (id in (select auth_account_ids()));

create policy "select own account_users" on account_users
  for select using (account_id in (select auth_account_ids()));

create policy "crud payment_methods" on payment_methods
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud categories" on categories
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud telegram_recipients" on telegram_recipients
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud expense_templates" on expense_templates
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud income_templates" on income_templates
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud expense_entries" on expense_entries
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud income_entries" on income_entries
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud fund_initial_balance" on fund_initial_balance
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud fund_balance_checks" on fund_balance_checks
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

create policy "crud fund_movements" on fund_movements
  for all using (account_id in (select auth_account_ids()))
  with check (account_id in (select auth_account_ids()));

-- -----------------------------------------------------------------
-- Trigger: cuando un usuario nuevo se autentica por primera vez,
-- crear su cuenta familiar automáticamente si no tiene ninguna.
-- (Se invoca desde la app tras el primer login, ver src/lib/supabase/onboarding.ts)
-- -----------------------------------------------------------------
