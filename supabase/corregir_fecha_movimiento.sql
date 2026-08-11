-- =========================================================
-- Corrección puntual de la fecha de un movimiento ya cargado
-- =========================================================

-- 1) Ubicar el movimiento (ajustá la fecha y/o el nombre para encontrarlo)
select id, tipo, monto, fecha, descripcion, referencia_tipo, referencia_id
from finanzas_py.fund_movements
where fecha = '2026-08-08'
order by created_at desc;

-- 2) Con el ID de la fila de arriba, corregir el movimiento del libro mayor
--    (esto es lo que afecta el extracto y el saldo)
update finanzas_py.fund_movements
set fecha = '2026-07-27'
where id = 'PEGAR_ID_AQUI';

-- 3) Corregir también la fecha guardada en el ingreso o gasto de origen,
--    para que Mes Actual/Extras muestren lo mismo que el extracto.
--    Usar income_entries + fecha_aplicacion si es un ingreso,
--    o expense_entries + fecha_pago si es un gasto (referencia_tipo lo dice).

-- Si es un INGRESO:
update finanzas_py.income_entries
set fecha_aplicacion = '2026-07-27'
where id = (
  select referencia_id from finanzas_py.fund_movements where id = 'PEGAR_ID_AQUI'
);

-- Si en cambio fuera un GASTO, sería:
-- update finanzas_py.expense_entries
-- set fecha_pago = '2026-07-27'
-- where id = (
--   select referencia_id from finanzas_py.fund_movements where id = 'PEGAR_ID_AQUI'
-- );
