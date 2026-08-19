import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import {
  getInicioPeriodoActual,
  getPeriodosSiguientes,
  toISODate,
  formatPeriodoCorto,
} from '@/lib/period';
import VigenciasManager, { type PlantillaConVigencias } from '@/components/VigenciasManager';
import { Aviso } from '@/components/ui/Layout';

async function agregarVigencia(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const tipo = String(formData.get('tipo'));
  const template_id = String(formData.get('template_id'));
  const desde_periodo = String(formData.get('desde_periodo'));
  const activo = formData.get('activo') === 'true';
  const montoRaw = String(formData.get('monto') || '');
  const nota = String(formData.get('nota') || '').trim() || null;

  if (!template_id || !desde_periodo) return;

  const tabla =
    tipo === 'ingreso' ? 'income_template_vigencias' : 'expense_template_vigencias';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(tabla).upsert(
    {
      account_id: accountId,
      template_id,
      desde_periodo,
      activo,
      // Vacío = no cambiar el monto, solo el estado de aplicación
      monto: montoRaw ? Number(montoRaw) : null,
      nota,
    },
    { onConflict: 'template_id,desde_periodo' }
  );
  if (error) throw new Error(error.message);

  revalidatePath('/configuracion/vigencias');
  revalidatePath('/previsiones');
}

async function quitarVigencia(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const tipo = String(formData.get('tipo'));
  const tabla =
    tipo === 'ingreso' ? 'income_template_vigencias' : 'expense_template_vigencias';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/configuracion/vigencias');
  revalidatePath('/previsiones');
}

export default async function VigenciasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  if (!accountId) {
    return (
      <Aviso tono="alerta">
        No encontramos una cuenta vinculada a esta sesión. Cerrá sesión y volvé a entrar.
      </Aviso>
    );
  }

  const [
    { data: gastos },
    { data: ingresos },
    { data: vigGastos },
    { data: vigIngresos },
  ] = await Promise.all([
    supabase.from('expense_templates').select('*').eq('account_id', accountId).order('nombre'),
    supabase.from('income_templates').select('*').eq('account_id', accountId).order('nombre'),
    supabase.from('expense_template_vigencias').select('*').eq('account_id', accountId),
    supabase.from('income_template_vigencias').select('*').eq('account_id', accountId),
  ]);

  const plantillas: PlantillaConVigencias[] = [
    ...(gastos ?? []).map((g) => ({
      id: g.id,
      nombre: g.nombre,
      monto: Number(g.monto),
      activo: g.activo,
      tipo: 'gasto' as const,
      vigencias: (vigGastos ?? []).filter((v) => v.template_id === g.id),
    })),
    ...(ingresos ?? []).map((i) => ({
      id: i.id,
      nombre: i.nombre,
      monto: Number(i.monto),
      activo: i.activo,
      tipo: 'ingreso' as const,
      vigencias: (vigIngresos ?? []).filter((v) => v.template_id === i.id),
    })),
  ];

  // Período vigente + los próximos 24, para poder programar con anticipación
  const actual = getInicioPeriodoActual();
  const periodos = [
    { iso: toISODate(actual), label: `${formatPeriodoCorto(actual)} (actual)` },
    ...getPeriodosSiguientes(24).map((p) => ({
      iso: toISODate(p),
      label: formatPeriodoCorto(p),
    })),
  ];

  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Reglas para plantillas que cambian de monto o dejan de aplicar a partir de cierto mes: la
        colegiatura que solo corre de febrero a noviembre, un sueldo que aumenta desde enero. Cada
        regla rige desde el período indicado hasta que aparezca otra más nueva.
      </p>

      <div className="mb-6">
        <Aviso>
          <p className="mb-2 font-medium">Cómo se arman las reglas</p>
          <p className="mb-1">
            <strong>Colegio de febrero a noviembre:</strong> una regla en febrero con &quot;Aplica:
            Sí&quot; y otra en diciembre con &quot;Aplica: No&quot;. Al año siguiente repetís, con el
            monto nuevo si hubo aumento.
          </p>
          <p>
            <strong>Aumento desde enero:</strong> una sola regla en enero con el monto nuevo. Los
            períodos anteriores siguen proyectándose con el importe actual.
          </p>
        </Aviso>
      </div>

      <VigenciasManager
        plantillas={plantillas}
        periodos={periodos}
        agregarVigencia={agregarVigencia}
        quitarVigencia={quitarVigencia}
      />
    </div>
  );
}
