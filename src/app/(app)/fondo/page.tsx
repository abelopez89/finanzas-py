import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import { getMovimientosUnificados, type FiltrosMovimientos } from '@/lib/movimientos';
import { toISODate, getPeriodosAnteriores, formatPeriodoCorto } from '@/lib/period';
import { construirExtractoMensual, construirBufferExtracto } from '@/lib/extractoMensual';
import { sendTelegramDocumentBroadcast } from '@/lib/telegram';
import ExtractoMensualPanel from '@/components/ExtractoMensualPanel';
import type { ResultadoPrueba } from '@/components/TestTelegramButton';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import MovimientosList from '@/components/MovimientosList';
import ChequeosHistorial from '@/components/ChequeosHistorial';
import Paginador from '@/components/ui/Paginador';
import FiltrosPanel from '@/components/ui/FiltrosPanel';
import { PageHeader, Section, Aviso } from '@/components/ui/Layout';
import { revalidatePath } from 'next/cache';

async function registrarChequeoSaldo(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const montoInformado = Number(formData.get('monto_informado'));
  const fecha = String(formData.get('fecha') ?? '');
  if (!montoInformado || !fecha) return;

  const supabase = createSupabaseServerClient();

  const { data: movimientos } = await supabase
    .from('fund_movements')
    .select('tipo, monto')
    .eq('account_id', accountId);

  const saldoEsperado = calcularSaldoFondo(movimientos ?? []);
  const interesCalculado = montoInformado - saldoEsperado;

  const { data: check, error } = await supabase
    .from('fund_balance_checks')
    .insert({
      account_id: accountId,
      fecha,
      monto_informado: montoInformado,
      saldo_esperado_sistema: saldoEsperado,
      interes_calculado: interesCalculado,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (interesCalculado !== 0) {
    await supabase.from('fund_movements').insert({
      account_id: accountId,
      tipo: 'interes',
      monto: interesCalculado,
      fecha,
      referencia_tipo: 'fund_balance_checks',
      referencia_id: check.id,
      descripcion: 'Interés calculado por diferencia de saldo',
    });
  }

  revalidatePath('/fondo');
}

async function enviarExtractoPorTelegram(
  _prev: ResultadoPrueba,
  formData: FormData
): Promise<ResultadoPrueba> {
  'use server';

  try {
    const accountId = await getCurrentAccountId();
    if (!accountId) {
      return { ok: false, mensaje: 'No se encontró la cuenta de tu sesión.' };
    }

    const periodoISO = String(formData.get('periodo') ?? '');
    if (!periodoISO) {
      return { ok: false, mensaje: 'Falta elegir un período.' };
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return {
        ok: false,
        mensaje: 'Falta TELEGRAM_BOT_TOKEN en las variables de entorno de Vercel.',
      };
    }

    const supabase = createSupabaseServerClient();
    const { data: destinatarios } = await supabase
      .from('telegram_recipients')
      .select('chat_id')
      .eq('account_id', accountId)
      .eq('activo', true);

    const chatIds = (destinatarios ?? []).map((d) => d.chat_id);
    if (chatIds.length === 0) {
      return { ok: false, mensaje: 'No hay destinatarios de Telegram activos.' };
    }

    const extracto = await construirExtractoMensual(accountId, periodoISO);
    const buffer = construirBufferExtracto(extracto);
    const caption =
      `<b>Extracto — ${extracto.periodoLabel}</b>\n` +
      `Saldo anterior: ₲ ${extracto.saldoAnterior.toLocaleString('es-PY')}\n` +
      `Saldo final: ₲ ${extracto.saldoFinal.toLocaleString('es-PY')}`;

    const { enviados, fallidos } = await sendTelegramDocumentBroadcast(
      chatIds,
      buffer,
      `extracto_${periodoISO}.xlsx`,
      caption
    );

    if (fallidos.length > 0) {
      return {
        ok: false,
        mensaje: `Enviado a ${enviados} de ${chatIds.length}. Falló: ${fallidos
          .map((f) => `${f.chatId} — ${f.error}`)
          .join(' · ')}`,
      };
    }

    return {
      ok: true,
      mensaje: `Extracto enviado a ${enviados} destinatario${enviados === 1 ? '' : 's'}.`,
    };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return { ok: false, mensaje: `No se pudo enviar: ${detalle}` };
  }
}

const POR_PAGINA = 25;

export default async function FondoPage({
  searchParams,
}: {
  searchParams: FiltrosMovimientos & { pagina?: string };
}) {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  if (!accountId) {
    return (
      <Aviso tono="alerta">
        No encontramos una cuenta vinculada a esta sesión. Cerrá sesión y volvé a entrar.
      </Aviso>
    );
  }

  const [{ data: movimientosFondo }, { data: chequeos }, movimientos, { data: destinatariosTelegram }] =
    await Promise.all([
      supabase.from('fund_movements').select('*').eq('account_id', accountId),
      supabase
        .from('fund_balance_checks')
        .select('*')
        .eq('account_id', accountId)
        .order('fecha', { ascending: false })
        .limit(24),
      getMovimientosUnificados(accountId, searchParams),
      supabase
        .from('telegram_recipients')
        .select('id')
        .eq('account_id', accountId)
        .eq('activo', true),
    ]);

  const saldoActual = calcularSaldoFondo(movimientosFondo ?? []);
  const totalGastos = movimientos.filter((m) => m.tipo === 'Gasto').reduce((a, m) => a + m.monto, 0);
  const totalIngresos = movimientos
    .filter((m) => m.tipo === 'Ingreso')
    .reduce((a, m) => a + m.monto, 0);

  const paginaActual = Math.max(1, Number(searchParams.pagina) || 1);
  const totalPaginas = Math.max(1, Math.ceil(movimientos.length / POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const movimientosPagina = movimientos.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA
  );

  const periodosDisponibles = getPeriodosAnteriores(12)
    .slice()
    .reverse()
    .map((p) => ({ iso: toISODate(p), label: formatPeriodoCorto(p) }));

  const hayFiltros = Boolean(
    searchParams.q || searchParams.tipo || searchParams.origen || searchParams.desde || searchParams.hasta
  );
  const queryString = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <div>
      <PageHeader titulo="Fondo mutuo" />

      {/* ---------- Saldo ---------- */}
      <section className="mb-6 overflow-hidden rounded-card bg-ink px-5 py-5 text-white sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-300">Saldo actual</p>
        <p className="mt-1.5 font-mono text-[32px] font-semibold leading-none tracking-tight sm:text-[38px]">
          <span className="mr-2 text-[0.5em] font-normal text-ink-300">₲</span>
          {new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(saldoActual))}
        </p>
      </section>

      {/* ---------- Registrar saldo real / interés ---------- */}
      <Section titulo="Registrar saldo real">
        <div className="card p-4">
          <p className="mb-3 text-sm text-ink-500">
            La diferencia contra el saldo calculado se registra como interés.
          </p>
          <form action={registrarChequeoSaldo} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="saldo-real">
                Saldo del banco
              </label>
              <MontoInput name="monto_informado" placeholder="0" required />
            </div>
            <div>
              <label className="label" htmlFor="fecha-chequeo">
                Fecha
              </label>
              <input
                id="fecha-chequeo"
                name="fecha"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="field"
                required
              />
            </div>
            <button className="btn-primary">Registrar</button>
          </form>

          <ChequeosHistorial chequeos={chequeos ?? []} />

        </div>
      </Section>

      {/* ---------- Extracto mensual ---------- */}
      <Section titulo="Extracto mensual">
        <ExtractoMensualPanel
          periodos={periodosDisponibles}
          hayDestinatarios={(destinatariosTelegram ?? []).length > 0}
          enviarPorTelegram={enviarExtractoPorTelegram}
        />
      </Section>

      {/* ---------- Movimientos ---------- */}
      <Section titulo="Movimientos confirmados">
        <div className="card mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-sm text-ink-400">
            Egresos <Money value={totalGastos} size="sm" className="font-semibold text-brick-600" />
          </span>
          <span className="text-sm text-ink-400">
            Ingresos{' '}
            <Money value={totalIngresos} size="sm" className="font-semibold text-pine-700" />
          </span>
          <span className="text-sm text-ink-400">
            Neto{' '}
            <Money
              value={Math.abs(totalIngresos - totalGastos)}
              signo={totalIngresos - totalGastos >= 0 ? 'ingreso' : 'egreso'}
              size="sm"
              className={`font-semibold ${
                totalIngresos - totalGastos >= 0 ? 'text-pine-700' : 'text-brick-600'
              }`}
            />
          </span>
        </div>

        <FiltrosPanel hayFiltrosActivos={hayFiltros}>
          <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <label className="label" htmlFor="q">
                Buscar
              </label>
              <input
                id="q"
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="Nombre del movimiento"
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="tipo">
                Tipo
              </label>
              <select id="tipo" name="tipo" defaultValue={searchParams.tipo ?? ''} className="field">
                <option value="">Todos</option>
                <option value="Gasto">Gasto</option>
                <option value="Ingreso">Ingreso</option>
                <option value="Interés">Interés</option>
                <option value="Saldo inicial">Saldo inicial</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="origen">
                Origen
              </label>
              <select id="origen" name="origen" defaultValue={searchParams.origen ?? ''} className="field">
                <option value="">Todos</option>
                <option value="Regular">Regular</option>
                <option value="Extra">Extra</option>
                <option value="Fondo">Fondo</option>
              </select>
            </div>
            <div className="hidden sm:block" />
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
            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-3">
              <button className="btn-primary flex-1 sm:flex-none">Aplicar</button>
              {hayFiltros && (
                <a href="/fondo" className="btn-secondary">
                  Limpiar
                </a>
              )}
              <a
                href={`/api/movimientos/export${queryString ? `?${queryString}` : ''}`}
                className="btn-secondary sm:ml-auto"
              >
                Descargar Excel
              </a>
            </div>
          </form>
        </FiltrosPanel>

        <MovimientosList
          movimientos={movimientosPagina.map((m) => ({
            id: m.id,
            tipo: m.tipo,
            origen: m.origen,
            nombre: m.nombre,
            fecha: toISODate(m.fecha),
            monto: m.monto,
          }))}
        />

        <Paginador
          paginaActual={paginaSegura}
          totalPaginas={totalPaginas}
          totalItems={movimientos.length}
          basePath="/fondo"
          baseParams={{
            q: searchParams.q,
            tipo: searchParams.tipo,
            origen: searchParams.origen,
            desde: searchParams.desde,
            hasta: searchParams.hasta,
          }}
        />
      </Section>
    </div>
  );
}
