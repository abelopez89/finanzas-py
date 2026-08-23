-- =========================================================
-- finanzas-py · Optimizaciones de performance + fix de borrado
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Es idempotente: se puede correr de nuevo sin romper nada.
-- =========================================================

-- ---------------------------------------------------------
-- 1) OMISIONES: por qué existe esta tabla
--
-- /mes-actual regenera los movimientos desde las plantillas en cada
-- render. Eso hacía que un gasto regular borrado a mano volviera a
-- aparecer al instante siguiente (el borrado "no funcionaba").
-- Ahora, al borrar un movimiento generado desde plantilla, se anota
-- acá que ESA plantilla no debe volver a generarse en ESE período.
-- ---------------------------------------------------------
create table if not exists finanzas_py.entry_omisiones (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  tipo text not null check (tipo in ('gasto', 'ingreso')),
  template_id uuid not null,
  periodo date not null,
  created_at timestamptz not null default now(),
  unique (account_id, tipo, template_id, periodo)
);

create index if not exists idx_entry_omisiones_periodo
  on finanzas_py.entry_omisiones(account_id, periodo);

alter table finanzas_py.entry_omisiones enable row level security;

drop policy if exists "crud entry_omisiones" on finanzas_py.entry_omisiones;
create policy "crud entry_omisiones" on finanzas_py.entry_omisiones
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

-- ---------------------------------------------------------
-- 2) MARCADOR DE PERÍODO GENERADO
--
-- Antes, cada visita a /mes-actual disparaba 6 consultas de generación
-- (plantillas + vigencias + existentes, x2) aunque el período ya
-- estuviera generado hace semanas. Ahora se consulta un único marcador:
-- si existe, se saltea toda la generación.
-- El botón "Regenerar desde plantillas" fuerza igual la pasada completa.
-- ---------------------------------------------------------
create table if not exists finanzas_py.period_generations (
  account_id uuid not null references finanzas_py.accounts(id) on delete cascade,
  periodo date not null,
  generado_at timestamptz not null default now(),
  primary key (account_id, periodo)
);

alter table finanzas_py.period_generations enable row level security;

drop policy if exists "crud period_generations" on finanzas_py.period_generations;
create policy "crud period_generations" on finanzas_py.period_generations
  for all using (account_id in (select finanzas_py.auth_account_ids()))
  with check (account_id in (select finanzas_py.auth_account_ids()));

-- Se marcan como ya generados todos los períodos que YA tienen
-- movimientos: si no, la primera visita después de este script haría
-- una pasada de generación innecesaria por cada período viejo.
insert into finanzas_py.period_generations (account_id, periodo)
select distinct account_id, periodo
from finanzas_py.expense_entries
where es_extra = false
on conflict do nothing;

-- ---------------------------------------------------------
-- 3) ÍNDICES QUE FALTABAN
-- ---------------------------------------------------------

-- Se usa en CADA cambio de estado (buscar el movimiento del fondo
-- ligado a un gasto/ingreso, y borrarlo al revertir). Sin este índice
-- era un scan completo de fund_movements.
create index if not exists idx_fund_movements_referencia
  on finanzas_py.fund_movements(referencia_tipo, referencia_id);

-- La consulta más frecuente de la app: movimientos regulares del período.
create index if not exists idx_expense_entries_periodo_extra
  on finanzas_py.expense_entries(account_id, periodo, es_extra);
create index if not exists idx_income_entries_periodo_extra
  on finanzas_py.income_entries(account_id, periodo, es_extra);

-- Atrasados del dashboard y de /mes-actual (filtran por estado).
create index if not exists idx_expense_entries_estado
  on finanzas_py.expense_entries(account_id, estado);
create index if not exists idx_income_entries_estado
  on finanzas_py.income_entries(account_id, estado);

-- Generación mensual: chequeo de "¿ya existe una entry para esta plantilla?"
create index if not exists idx_expense_entries_template
  on finanzas_py.expense_entries(template_id, periodo);
create index if not exists idx_income_entries_template
  on finanzas_py.income_entries(template_id, periodo);

-- ---------------------------------------------------------
-- 4) Permisos (las tablas nuevas necesitan el grant del esquema)
-- ---------------------------------------------------------
grant all on all tables in schema finanzas_py to anon, authenticated, service_role;
