import { Aviso, EmptyState } from '@/components/ui/Layout';
import FormularioAlta from '@/components/ui/FormularioAlta';

type Item = { id: string; nombre: string; activo: boolean };

/**
 * Lista simple de configuración (métodos de pago, categorías): alta rápida
 * arriba, listado con activar/desactivar debajo.
 */
export default function ConfigListaSimple({
  items,
  error,
  sinCuenta,
  placeholder,
  vacio,
  onAdd,
  onToggle,
}: {
  items: Item[];
  error?: string | null;
  sinCuenta?: boolean;
  placeholder: string;
  vacio: string;
  onAdd: (formData: FormData) => void;
  onToggle: (formData: FormData) => void;
}) {
  return (
    <div>
      {error && (
        <div className="mb-4">
          <Aviso tono="error">
            No pudimos leer los datos: {error}. Revisá que el esquema <code>finanzas_py</code> esté
            expuesto en Supabase (Project Settings → API → Exposed schemas).
          </Aviso>
        </div>
      )}
      {sinCuenta && (
        <div className="mb-4">
          <Aviso tono="alerta">
            No encontramos una cuenta vinculada a esta sesión. Cerrá sesión y volvé a entrar.
          </Aviso>
        </div>
      )}

      <FormularioAlta action={onAdd} className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input name="nombre" placeholder={placeholder} className="field flex-1" required />
        <button className="btn-primary sm:w-auto">Agregar</button>
      </FormularioAlta>

      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className={item.activo ? 'text-ink' : 'text-ink-400 line-through'}>
              {item.nombre}
            </span>
            <form action={onToggle}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="activo" value={String(item.activo)} />
              <button className="btn-row text-ink-500 hover:bg-canvas">
                {item.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </li>
        ))}
        {items.length === 0 && <EmptyState mensaje={vacio} />}
      </ul>
    </div>
  );
}
