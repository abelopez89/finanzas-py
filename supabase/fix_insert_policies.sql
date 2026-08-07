-- Fix: faltaban políticas de INSERT (y UPDATE para account_users)
-- Sin esto, el primer login no puede crear la cuenta familiar (error 500
-- en /api/auth/callback).

create policy "insert own account" on finanzas_py.accounts
  for insert to authenticated
  with check (true);

create policy "insert own account_users" on finanzas_py.account_users
  for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy "update own account_users" on finanzas_py.account_users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
