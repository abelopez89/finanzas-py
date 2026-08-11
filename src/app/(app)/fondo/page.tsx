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

export default async function FondoPage({ searchParams }: { searchParams: FiltrosMovimientos }) {
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
        .limit(6),
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
      <section className="mb-6 overflow-hidden rounded-card bg-ink px-5 py-6 text-white sm:px-7 sm:py-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-300">Saldo actual</p>
        <p className="mt-2 font-mono text-[34px] font-semibold leading-none tracking-tight sm:text-[44px]">
          <span className="mr-2 text-[0.5em] font-normal text-ink-300">₲</span>
          {new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(saldoActual))}
        </p>
        <p className="mt-3 text-[13px] text-ink-300">
          Calculado sobre todos los movimientos confirmados.
        </p>
      </section>

      {/* ---------- Registrar saldo real / interés ---------- */}
      <Section titulo="Registrar saldo real">
        <div className="card p-4">
          <p className="mb-4 text-sm text-ink-500">
            Ingresá el saldo que muestra tu banco hoy. La diferencia contra el saldo calculado se
            registra como interés generado.
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

          {(chequeos ?? []).length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Últimos registros
              </p>
              <ul className="space-y-2">
                {(chequeos ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono text-[13px] text-ink-500">{c.fecha}</span>
                    <span className="flex-1 truncate text-right text-ink-400">
                      informado <Money value={c.monto_informado} size="sm" className="text-ink-500" />
                    </span>
                    <span
                      className={`shrink-0 font-medium ${
                        Number(c.interes_calculado) >= 0 ? 'text-pine-700' : 'text-brick-600'
                      }`}
                    >
                      <Money
                        value={Math.abs(Number(c.interes_calculado))}
                        signo={Number(c.interes_calculado) >= 0 ? 'ingreso' : 'egreso'}
                        size="sm"
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="card p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Egresos</p>
            <Money value={totalGastos} className="mt-1 block font-semibold text-brick-600" />
          </div>
          <div className="card p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Ingresos</p>
            <Money value={totalIngresos} className="mt-1 block font-semibold text-pine-700" />
          </div>
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
          movimientos={movimientos.map((m) => ({
            id: m.id,
            tipo: m.tipo,
            origen: m.origen,
            nombre: m.nombre,
            fecha: toISODate(m.fecha),
            monto: m.monto,
          }))}
        />
      </Section>
    </div>
  );
}
