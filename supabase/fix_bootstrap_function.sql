-- Reemplaza la creación de cuenta "a mano" (insert + select, que choca con
-- RLS por el problema de RETURNING) por una función SECURITY DEFINER que
-- crea la cuenta y el vínculo del usuario de forma atómica, sin pasar por
-- las políticas normales (que no pueden autorizar la primera fila de un
-- usuario nuevo porque todavía no existe nada que las satisfaga).

create or replace function finanzas_py.create_account_for_user(p_email text, p_nombre text default 'Familia')
returns uuid
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

  if v_account_id is not null then
    return v_account_id;
  end if;

  insert into finanzas_py.accounts (nombre) values (p_nombre)
  returning id into v_account_id;

  insert into finanzas_py.account_users (account_id, auth_user_id, email, is_owner)
  values (v_account_id, auth.uid(), p_email, true);

  return v_account_id;
end;
$$;

grant execute on function finanzas_py.create_account_for_user(text, text) to authenticated;

-- Misma idea para vincular un segundo correo a la cuenta ya existente.
create or replace function finanzas_py.link_email_to_my_account(p_email text, p_nombre text default null)
returns uuid
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
    raise exception 'No se encontró una cuenta para vincular este correo';
  end if;

  insert into finanzas_py.account_users (account_id, auth_user_id, email, nombre)
  values (v_account_id, auth.uid(), p_email, p_nombre)
  on conflict (account_id, email) do update set nombre = excluded.nombre;

  return v_account_id;
end;
$$;

grant execute on function finanzas_py.link_email_to_my_account(text, text) to authenticated;
