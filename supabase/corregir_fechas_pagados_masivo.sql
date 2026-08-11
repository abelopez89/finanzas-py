-- =========================================================
-- Forzar fecha_pago = fecha teórica (período + día) en gastos ya
-- PAGADOS y NO extra. Reconstruye la fecha igual que lo hace la app
-- (src/lib/period.ts → fechaDeEntry): día >= 27 cae en el mes del
-- período; día <= 26 cae en el mes siguiente.
-- =========================================================

-- 0) Confirmá tu account_id antes de correr nada (por si el proyecto de
--    Supabase tiene más de una cuenta familiar, para no tocar otra).
select account_id, email from finanzas_py.account_users where auth_user_id = auth.uid();

-- 1) VISTA PREVIA — mirá qué va a cambiar antes de aplicar nada.
--    Reemplazá 'TU_ACCOUNT_ID' por el valor que te devolvió el paso 0.
select
  e.id,
  e.nombre,
  e.periodo,
  e.dia,
  e.fecha_pago as fecha_pago_actual,
  case
    when e.dia >= 27
      then (date_trunc('month', e.periodo) + (e.dia - 1) * interval '1 day')::date
    else
      (date_trunc('month', e.periodo) + interval '1 month' + (e.dia - 1) * interval '1 day')::date
  end as fecha_pago_correcta
from finanzas_py.expense_entries e
where e.estado = 'pagado'
  and e.es_extra = false
  and e.account_id = 'TU_ACCOUNT_ID'
order by e.periodo, e.dia;

-- 2) APLICAR — corrige expense_entries.fecha_pago
update finanzas_py.expense_entries e
set fecha_pago = case
    when e.dia >= 27
      then (date_trunc('month', e.periodo) + (e.dia - 1) * interval '1 day')::date
    else
      (date_trunc('month', e.periodo) + interval '1 month' + (e.dia - 1) * interval '1 day')::date
  end
where e.estado = 'pagado'
  and e.es_extra = false
  and e.account_id = 'TU_ACCOUNT_ID';

-- 3) APLICAR — corrige también el libro mayor (fund_movements), que es lo
--    que arma el extracto y el gráfico del dashboard. Tiene que correr
--    DESPUÉS del paso 2, porque usa el fecha_pago ya corregido.
update finanzas_py.fund_movements fm
set fecha = e.fecha_pago
from finanzas_py.expense_entries e
where fm.referencia_tipo = 'expense_entries'
  and fm.referencia_id = e.id
  and e.estado = 'pagado'
  and e.es_extra = false
  and e.account_id = 'TU_ACCOUNT_ID';
