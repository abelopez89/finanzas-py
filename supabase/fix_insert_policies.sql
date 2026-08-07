-- Re-aplica (de forma idempotente) las políticas de INSERT/UPDATE que
-- permiten crear la cuenta familiar en el primer login.

drop policy if exists "insert own account" on finanzas_py.accounts;
create policy "insert own account" on finanzas_py.accounts
  for insert to authenticated
  with check (true);

drop policy if exists "insert own account_users" on finanzas_py.account_users;
create policy "insert own account_users" on finanzas_py.account_users
  for insert to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "update own account_users" on finanzas_py.account_users;
create policy "update own account_users" on finanzas_py.account_users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Verificación: esto debería devolver 3 filas (insert en accounts,
-- insert y update en account_users).
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'finanzas_py'
  and tablename in ('accounts', 'account_users')
order by tablename, cmd;
