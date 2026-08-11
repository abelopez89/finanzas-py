-- =========================================================
-- Forzar fecha_aplicacion = fecha teórica (período + día) en ingresos ya
-- CONFIRMADOS y NO extra. Misma lógica que la corrección de gastos.
-- =========================================================

-- 0) Confirmá tu account_id (mismo de siempre).
select account_id, email from finanzas_py.account_users where auth_user_id = auth.uid();

-- 1) VISTA PREVIA — reemplazá 'TU_ACCOUNT_ID' antes de correr.
select
  i.id,
  i.nombre,
  i.periodo,
  i.dia,
  i.fecha_aplicacion as fecha_aplicacion_actual,
  case
    when i.dia >= 27
      then (date_trunc('month', i.periodo) + (i.dia - 1) * interval '1 day')::date
    else
      (date_trunc('month', i.periodo) + interval '1 month' + (i.dia - 1) * interval '1 day')::date
  end as fecha_aplicacion_correcta
from finanzas_py.income_entries i
where i.estado = 'confirmado'
  and i.es_extra = false
  and i.account_id = 'TU_ACCOUNT_ID'
order by i.periodo, i.dia;

-- 2) APLICAR — corrige income_entries.fecha_aplicacion
update finanzas_py.income_entries i
set fecha_aplicacion = case
    when i.dia >= 27
      then (date_trunc('month', i.periodo) + (i.dia - 1) * interval '1 day')::date
    else
      (date_trunc('month', i.periodo) + interval '1 month' + (i.dia - 1) * interval '1 day')::date
  end
where i.estado = 'confirmado'
  and i.es_extra = false
  and i.account_id = 'TU_ACCOUNT_ID';

-- 3) APLICAR — corrige el libro mayor (fund_movements). Va DESPUÉS del
--    paso 2, porque usa la fecha_aplicacion ya corregida.
update finanzas_py.fund_movements fm
set fecha = i.fecha_aplicacion
from finanzas_py.income_entries i
where fm.referencia_tipo = 'income_entries'
  and fm.referencia_id = i.id
  and i.estado = 'confirmado'
  and i.es_extra = false
  and i.account_id = 'TU_ACCOUNT_ID';
