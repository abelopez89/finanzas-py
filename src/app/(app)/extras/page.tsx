import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import MontoInput from '@/components/MontoInput';
import ExtrasList from '@/components/ExtrasList';
import NuevoPanel from '@/components/ui/NuevoPanel';
import FormularioAlta from '@/components/ui/FormularioAlta';
import FiltrosPanel from '@/components/ui/FiltrosPanel';
import { PageHeader, Section } from '@/components/ui/Layout';
import {
  addExpenseExtra,
  addIncomeExtra,
  deleteExpenseExtra,
  deleteIncomeExtra,
  updateExpenseExtra,
  updateIncomeExtra,
  cambiarEstadoGasto,
  cambiarEstadoIngreso,
} from '@/lib/actions/entries';

type Filtros = { estado?: string; desde?: string; hasta?: string };

export default async function ExtrasPage({ searchParams }: { searchParams: Filtros }) {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  let gastosQuery = accountId
    ? supabase
        .from('expense_entries')
        .select('*, payment_methods(nombre)')
        .eq('account_id', accountId)
        .eq('es_extra', true)
    : null;
  let ingresosQuery = accountId
    ? supabase.from('income_entries').select('*').eq('account_id', accountId).eq('es_extra', true)
    : null;

  const estado = searchParams.estado ?? '';

  if (gastosQuery && ingresosQuery) {
    // Por defecto solo lo que queda por resolver. Lo pagado/confirmado se
    // trae solo si se pide explícitamente.
    if (estado === '') {
      gastosQuery = gastosQuery.in('estado', ['pendiente', 'rescatado']);
      ingresosQuery = ingresosQuery.eq('estado', 'pendiente');
    } else if (estado !== 'todos') {
      gastosQuery = gastosQuery.eq('estado', estado);
      ingresosQuery = ingresosQuery.eq('estado', estado);
    }
    if (searchParams.desde) {
      gastosQuery = gastosQuery.gte('fecha_vencimiento', searchParams.desde);
      ingresosQuery = ingresosQuery.gte('fecha_aplicacion', searchParams.desde);
    }
    if (searchParams.hasta) {
      gastosQuery = gastosQuery.lte('fecha_vencimiento', searchParams.hasta);
      ingresosQuery = ingresosQuery.lte('fecha_aplicacion', searchParams.hasta);
    }
  }

  const [{ data: metodos }, { data: categorias }, { data: gastos }, { data: ingresos }] = accountId
    ? await Promise.all([
        supabase.from('payment_methods').select('*').eq('account_id', accountId).eq('activo', true),
        supabase.from('categories').select('*').eq('account_id', accountId).eq('activo', true),
        gastosQuery!,
        ingresosQuery!,
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

  // Orden: por fecha ascendente (lo que vence primero, arriba), después
  // por método de pago y por nombre. Los que no tienen fecha van al final.
  const gastosOrdenados = [...(gastos ?? [])].sort((a, b) => {
    const fa = a.fecha_vencimiento ?? '9999-12-31';
    const fb = b.fecha_vencimiento ?? '9999-12-31';
    if (fa !== fb) return fa.localeCompare(fb);
    const mA = (a as any).payment_methods?.nombre ?? '';
    const mB = (b as any).payment_methods?.nombre ?? '';
    const porMetodo = mA.localeCompare(mB, 'es');
    if (porMetodo !== 0) return porMetodo;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  const ingresosOrdenados = [...(ingresos ?? [])].sort((a, b) => {
    const fa = a.fecha_aplicacion ?? '9999-12-31';
    const fb = b.fecha_aplicacion ?? '9999-12-31';
    if (fa !== fb) return fa.localeCompare(fb);
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  const hayFiltros = Boolean(searchParams.estado || searchParams.desde || searchParams.hasta);

  return (
    <div>
      <PageHeader
        titulo="Extras"
        descripcion="Gastos e ingresos puntuales, fuera de las plantillas mensuales."
      />

      <FiltrosPanel hayFiltrosActivos={hayFiltros}>
        <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="estado">
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={estado} className="field">
              <option value="">Pendientes y rescatados</option>
              <option value="todos">Todos</option>
              <option value="pendiente">Solo pendientes</option>
              <option value="rescatado">Solo rescatados</option>
              <option value="pagado">Solo pagados</option>
              <option value="confirmado">Solo confirmados</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="desde">
              Desde
            </label>
            <input
              id="desde"
              name="desde"
              type="date"
              defaultValue={searchParams.desde ?? ''}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="hasta">
              Hasta
            </label>
            <input
              id="hasta"
              name="hasta"
              type="date"
              defaultValue={searchParams.hasta ?? ''}
              className="field"
            />
          </div>
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <button className="btn-primary flex-1">Aplicar</button>
            {hayFiltros && (
              <a href="/extras" className="btn-secondary">
                Limpiar
              </a>
            )}
          </div>
        </form>
      </FiltrosPanel>

      {/* ---------------- Gastos extra ---------------- */}
      <Section titulo="Gastos extra">
        <NuevoPanel etiqueta="Nuevo gasto extra">
          <FormularioAlta action={addExpenseExtra} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="g-nombre">
                Nombre
              </label>
              <input
                id="g-nombre"
                name="nombre"
                placeholder="Ej: Reparación del auto"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="g-monto">
                Monto
              </label>
              <MontoInput name="monto" placeholder="0" />
            </div>
            <div>
              <label className="label" htmlFor="g-venc">
                Vencimiento
              </label>
              <input id="g-venc" name="fecha_vencimiento" type="date" className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="g-metodo">
                Método de pago
              </label>
              <select id="g-metodo" name="payment_method_id" className="field">
                <option value="">Sin método</option>
                {(metodos ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="g-cat">
                Categoría
              </label>
              <select id="g-cat" name="category_id" className="field">
                <option value="">Sin categoría</option>
                {(categorias ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary w-full sm:w-auto">Agregar gasto</button>
            </div>
          </FormularioAlta>
        </NuevoPanel>

        <ExtrasList
          tipo="gasto"
          metodos={metodos ?? []}
          items={gastosOrdenados.map((g) => ({
            id: g.id,
            nombre: g.nombre,
            monto: g.monto,
            estado: g.estado,
            fecha: g.fecha_vencimiento,
            metodoId: g.payment_method_id,
            metodoNombre: (g as any).payment_methods?.nombre ?? null,
          }))}
          cambiarEstado={cambiarEstadoGasto}
          updateExtra={updateExpenseExtra}
          deleteEntry={deleteExpenseExtra}
        />
      </Section>

      {/* ---------------- Ingresos extra ---------------- */}
      <Section titulo="Ingresos extra">
        <NuevoPanel etiqueta="Nuevo ingreso extra">
          <FormularioAlta action={addIncomeExtra} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="i-nombre">
                Nombre
              </label>
              <input
                id="i-nombre"
                name="nombre"
                placeholder="Ej: Aguinaldo"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="i-monto">
                Monto
              </label>
              <MontoInput name="monto" placeholder="0" />
            </div>
            <div>
              <label className="label" htmlFor="i-fecha">
                Fecha
              </label>
              <input id="i-fecha" name="fecha_aplicacion" type="date" className="field" required />
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary w-full sm:w-auto">Agregar ingreso</button>
            </div>
          </FormularioAlta>
        </NuevoPanel>

        <ExtrasList
          tipo="ingreso"
          items={ingresosOrdenados.map((i) => ({
            id: i.id,
            nombre: i.nombre,
            monto: i.monto,
            estado: i.estado,
            fecha: i.fecha_aplicacion,
            metodoId: null,
            metodoNombre: null,
          }))}
          cambiarEstado={cambiarEstadoIngreso}
          updateExtra={updateIncomeExtra}
          deleteEntry={deleteIncomeExtra}
        />
      </Section>
    </div>
  );
}
