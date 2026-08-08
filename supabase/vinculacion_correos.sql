-- =========================================================
-- finanzas-py — Vinculación de correos por invitación
--
-- Reemplaza el mecanismo de linkIdentity (frágil: depende de opciones del
-- panel y falla si el correo ya existe como usuario separado) por uno
-- basado en invitación: se registra el correo en la cuenta familiar por
-- adelantado, y cuando esa persona entra con Google queda enganchada a
-- esa cuenta en vez de crear una nueva.
-- =========================================================

-- 1) El correo invitado todavía no tiene usuario de Supabase asociado,
--    así que auth_user_id tiene que poder quedar vacío hasta que entre.
alter table finanzas_py.account_users
  alter column auth_user_id drop not null;

-- 2) Al entrar, un usuario reclama la invitación que tenga su correo.
create or replace function finanzas_py.create_account_for_user(
  p_email text,
  p_nombre text default 'Familia'
)
returns uuid
language plpgsql
security definer
set search_path = finanzas_py, public
as $$
declare
  v_account_id uuid;
begin
  -- a) ¿Ya está enganchado a una cuenta?
  select account_id into v_account_id
  from finanzas_py.account_users
  where auth_user_id = auth.uid()
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  -- b) ¿Hay una invitación pendiente para su correo?
  select account_id into v_account_id
  from finanzas_py.account_users
  where lower(email) = lower(p_email)
    and auth_user_id is null
  limit 1;

  if v_account_id is not null then
    update finanzas_py.account_users
    set auth_user_id = auth.uid()
    where account_id = v_account_id
      and lower(email) = lower(p_email);
    return v_account_id;
  end if;

  -- c) Usuario nuevo sin invitación: cuenta propia.
  insert into finanzas_py.accounts (nombre) values (p_nombre)
  returning id into v_account_id;

  insert into finanzas_py.account_users (account_id, auth_user_id, email, is_owner)
  values (v_account_id, auth.uid(), p_email, true);

  return v_account_id;
end;
$$;

grant execute on function finanzas_py.create_account_for_user(text, text) to authenticated;

-- 3) Invitar un correo a MI cuenta familiar.
create or replace function finanzas_py.invitar_correo(p_email text, p_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = finanzas_py, public
as $$
declare
  v_account_id uuid;
  v_ya_en_otra uuid;
begin
  select account_id into v_account_id
  from finanzas_py.account_users
  where auth_user_id = auth.uid()
  limit 1;

  if v_account_id is null then
    raise exception 'No tenés una cuenta familiar todavía';
  end if;

  -- Si ese correo ya pertenece a otra cuenta, no se puede mover en silencio.
  select account_id into v_ya_en_otra
  from finanzas_py.account_users
  where lower(email) = lower(p_email)
    and account_id <> v_account_id
  limit 1;

  if v_ya_en_otra is not null then
    raise exception 'Ese correo ya pertenece a otra cuenta familiar';
  end if;

  insert into finanzas_py.account_users (account_id, auth_user_id, email, nombre)
  values (v_account_id, null, lower(p_email), p_nombre)
  on conflict (account_id, email) do nothing;

  return v_account_id;
end;
$$;

grant execute on function finanzas_py.invitar_correo(text, text) to authenticated;

-- 4) Quitar un correo de MI cuenta (no permite quitar al dueño ni a uno mismo).
create or replace function finanzas_py.quitar_correo(p_email text)
returns void
language plpgsql
security definer
set search_path = finanzas_py, public
as $$
declare
  v_account_id uuid;
begin
  select account_id into v_account_id
  from finanzas_py.account_users
  where auth_user_id = auth.uid()
  limit 1;

  if v_account_id is null then
    raise exception 'No tenés una cuenta familiar';
  end if;

  delete from finanzas_py.account_users
  where account_id = v_account_id
    and lower(email) = lower(p_email)
    and is_owner = false
    and (auth_user_id is null or auth_user_id <> auth.uid());
end;
$$;

grant execute on function finanzas_py.quitar_correo(text) to authenticated;

-- =========================================================
-- 5) REPARACIÓN: el segundo correo ya entró y se le creó una cuenta
--    familiar vacía aparte. Hay que borrarla y dejarlo enganchado a la
--    cuenta principal.
--
--    Primero mirá qué hay:
--       select au.email, au.account_id, au.is_owner, au.auth_user_id
--       from finanzas_py.account_users au order by au.created_at;
--
--    Después, reemplazando los valores, movelo a la cuenta correcta:
--
--    update finanzas_py.account_users
--    set account_id = '<ID_DE_LA_CUENTA_PRINCIPAL>', is_owner = false
--    where lower(email) = lower('<SEGUNDO_CORREO>');
--
--    delete from finanzas_py.accounts
--    where id = '<ID_DE_LA_CUENTA_VACIA>';
-- =========================================================
