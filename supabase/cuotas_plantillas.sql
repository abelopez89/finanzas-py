-- =========================================================
-- finanzas-py · Préstamos en cuotas en plantillas de gastos
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, ANTES de desplegar el
-- código que lo usa (Mes actual y el dashboard leen numero_cuota).
-- Es idempotente: se puede correr de nuevo sin romper nada.
--
-- Una plantilla con cuotas_total deja de generar gastos al llegar a la
-- última cuota, y la previsión la proyecta solo por las cuotas que quedan.
-- Plantillas sin cuotas_total (null) se comportan exactamente como antes.
-- =========================================================

-- cuotas_pagadas_inicial: cuotas pagadas fuera de la app (antes de cargar
-- el préstamo acá). Las que figuran como rescatadas/pagadas en
-- expense_entries se cuentan solas, no van en este número.
alter table finanzas_py.expense_templates
  add column if not exists cuotas_total integer
    check (cuotas_total is null or cuotas_total > 0);

alter table finanzas_py.expense_templates
  add column if not exists cuotas_pagadas_inicial integer not null default 0
    check (cuotas_pagadas_inicial >= 0);

-- Número de cuota congelado al generar el gasto (como el monto): editar
-- después la plantilla no renumera lo ya generado. Null en gastos que no
-- vienen de un préstamo o que se generaron antes de este script.
alter table finanzas_py.expense_entries
  add column if not exists numero_cuota integer;
