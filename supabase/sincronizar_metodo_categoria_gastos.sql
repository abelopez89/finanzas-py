-- =========================================================
-- finanzas-py — Sincronizar método/categoría de gastos con su plantilla
--
-- A diferencia del monto (que tiene vigencias y queda "congelado" en la
-- fecha de cada movimiento), método de pago y categoría son solo datos de
-- clasificación: no debían quedar copiados para siempre en el gasto
-- generado. Antes de este fix, cambiar el método o la categoría en una
-- plantilla no se propagaba a los gastos ya generados desde ella
-- (históricos ni los del mes actual) — quedaban con el valor viejo.
--
-- Este script hace una sincronización de una sola vez para lo que ya está
-- desalineado hoy. De acá en más, la Server Action que edita la plantilla
-- (updateExpenseTemplate) propaga el cambio automáticamente a cada gasto
-- generado desde ella.
--
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Es idempotente: correrlo
-- de nuevo no cambia nada si ya está todo sincronizado.
-- =========================================================

update finanzas_py.expense_entries e
set payment_method_id = t.payment_method_id,
    category_id = t.category_id
from finanzas_py.expense_templates t
where e.template_id = t.id
  and (
    e.payment_method_id is distinct from t.payment_method_id
    or e.category_id is distinct from t.category_id
  );
