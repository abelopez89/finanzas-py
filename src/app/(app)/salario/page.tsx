import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, toISODate, formatPeriodoLabel } from '@/lib/period';
import { construirResumenSalarios } from '@/lib/salario';
import MontoInput from '@/components/MontoInput';
import TarjetaSalario from '@/components/TarjetaSalario';
import NuevoPanel from '@/components/ui/NuevoPanel';
import FormularioAlta from '@/components/ui/FormularioAlta';
import { PageHeader, Aviso, EmptyState } from '@/components/ui/Layout';
import {
  addSalarySource,
  updateSalarySource,
  deleteSalarySource,
  addSalaryDeduction,
  updateSalaryDeduction,
  deleteSalaryDeduction,
  marcarDescuentoPagado,
  omitirDescuento,
  revertirDescuento,
} from '@/lib/actions/salario';

export default async function SalarioPage() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return (
      <Aviso tono="alerta">
        No encontramos una cuenta vinculada a esta sesión. Cerrá sesión y volvé a entrar.
      </Aviso>
    );
  }

  const supabase = createSupabaseServerClient();
  const periodo = getInicioPeriodoActual();
  const periodoISO = toISODate(periodo);
  const hoyISO = toISODate(new Date());

  const [salarios, { data: usuarios }] = await Promise.all([
    construirResumenSalarios(supabase, accountId, periodoISO),
    supabase.from('account_users').select('id, nombre, email').eq('account_id', accountId),
  ]);
  const opcionesUsuarios = (usuarios ?? []).map((u) => ({ id: u.id, nombre: u.nombre || u.email }));

  return (
    <div>
      <PageHeader
        titulo="Descuentos de salario"
        descripcion={`Lo que se paga con el salario antes de transferir al fondo mutuo. Es solo registro y recordatorio: no mueve el saldo del fondo. ${formatPeriodoLabel(periodo)}.`}
      />

      <NuevoPanel etiqueta="Nuevo salario">
        <FormularioAlta action={addSalarySource} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-nombre">
              Nombre
            </label>
            <input
              id="s-nombre"
              name="nombre"
              placeholder="Ej: Sueldo empresa"
              className="field"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="s-titular">
              Titular
            </label>
            <select id="s-titular" name="titular_user_id" className="field">
              <option value="">Sin titular</option>
              {opcionesUsuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-dia">
              Día de cobro
            </label>
            <input
              id="s-dia"
              name="dia_cobro"
              type="number"
              min={1}
              max={31}
              className="field"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="s-bruto">
              Monto bruto
            </label>
            <MontoInput name="monto_bruto" placeholder="0" />
          </div>
          <div>
            <label className="label" htmlFor="s-orden">
              Orden
            </label>
            <input id="s-orden" name="orden" type="number" defaultValue={0} className="field" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary w-full sm:w-auto">Agregar salario</button>
          </div>
        </FormularioAlta>
      </NuevoPanel>

      {salarios.map((s) => (
        <TarjetaSalario
          key={s.id}
          salario={s}
          usuarios={opcionesUsuarios}
          periodoISO={periodoISO}
          hoyISO={hoyISO}
          acciones={{
            marcarPagado: marcarDescuentoPagado,
            omitir: omitirDescuento,
            revertir: revertirDescuento,
            updateSource: updateSalarySource,
            deleteSource: deleteSalarySource,
            addDeduction: addSalaryDeduction,
            updateDeduction: updateSalaryDeduction,
            deleteDeduction: deleteSalaryDeduction,
          }}
        />
      ))}

      {salarios.length === 0 && (
        <div className="card">
          <EmptyState mensaje="Todavía no cargaste ningún salario." />
        </div>
      )}
    </div>
  );
}
