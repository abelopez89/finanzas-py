# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

App de gestión financiera familiar en español: ingresos, gastos, plantillas
mensuales recurrentes, control de un fondo mutuo (con cálculo de interés) y
previsión de saldo a 12 meses. Ver `README.md` para el detalle completo de
las etapas ya implementadas y las reglas de negocio de cada pantalla — está
muy actualizado y conviene leerlo antes de tocar lógica de negocio.

## Stack

- Next.js 14 (App Router) + TypeScript + React 18
- Tailwind CSS (paleta y fuentes custom en `tailwind.config.js`)
- Supabase (Postgres + Auth con Google OAuth) vía `@supabase/ssr`
- `date-fns` (con locale `es`) para fechas, `recharts` para gráficos, `xlsx` para exportar Excel
- Deploy en Vercel; cron diario disparado por un servicio externo (cron-job.org) contra un endpoint propio
- Notificaciones vía bot de Telegram (HTTP directo a la API de Telegram, sin SDK)

## Comandos

```bash
npm install
npm run dev     # servidor de desarrollo
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # next lint
```

No hay suite de tests configurada en este repo.

## Supabase: cómo está armado

- **Todo vive en el esquema Postgres `finanzas_py`, nunca en `public`.** El
  proyecto de Supabase se comparte con otras apps (`vacamanager`, `irp-py`);
  el esquema dedicado es lo que evita pisarlas. `auth.users` sí es
  compartido entre apps.
- Los clientes de Supabase (`src/lib/supabase/client.ts` y `server.ts`) fijan
  `db: { schema: 'finanzas_py' }`, así que en el código las tablas se llaman
  sin prefijo (`supabase.from('expense_entries')`, no `finanzas_py.expense_entries`).
- El schema y sus migraciones incrementales viven como archivos `.sql` sueltos
  en `supabase/` (no hay herramienta de migraciones): `schema.sql` es la base,
  y luego `vigencias_plantillas.sql`, `optimizaciones_performance.sql`,
  `reglas_plantilla.sql`, etc. son scripts idempotentes que se corren a mano
  en el SQL Editor de Supabase, en orden, cuando el código que los necesita
  se despliega. Al agregar una tabla o columna nueva, sumar un `.sql` nuevo
  (no editar `schema.sql` retroactivamente) y documentar en el `README.md`
  si es un paso obligatorio antes de deployar.
- Después de crear un schema nuevo hay que agregarlo a mano en el dashboard
  de Supabase (Project Settings → API → "Exposed schemas"); sin eso el
  cliente no puede leer/escribir nada aunque el SQL esté corrido.
- RLS activado en todas las tablas: una función `finanzas_py.auth_account_ids()`
  (`SECURITY DEFINER`) devuelve las cuentas del usuario autenticado, y cada
  policy filtra `account_id in (select finanzas_py.auth_account_ids())`.
- El alta de la primera cuenta y el vínculo de un segundo Gmail (`linkIdentity`)
  usan funciones `SECURITY DEFINER` (`create_account_for_user`,
  `link_email_to_my_account`) en vez de inserts directos desde el cliente,
  para esquivar un problema de RLS+`RETURNING` en la primera fila de un
  usuario nuevo (ver `src/lib/supabase/onboarding.ts`).

### Modelo de datos (tablas principales)

- `accounts` / `account_users`: una cuenta familiar agrupa varios
  `auth_user_id` (correos Gmail vinculados).
- `payment_methods`, `categories`, `telegram_recipients`: configuración por cuenta.
- `expense_templates` / `income_templates`: plantillas mensuales recurrentes
  (día del mes, monto, método de pago, categoría).
- `expense_template_vigencias` / `income_template_vigencias`: línea de tiempo
  de reglas por plantilla — desde qué período cambia el monto o el estado
  activo/inactivo, sin perder el valor anterior (ver `src/lib/vigencias.ts`).
  Se resuelve tomando la última regla con `desde_periodo <= período`.
- `expense_entries` / `income_entries`: movimientos reales de un período,
  generados desde una plantilla (`template_id`) o cargados como "extra"
  (`es_extra = true`, con `fecha_vencimiento`/`fecha_aplicacion` propia).
  Estados: gasto `pendiente → rescatado → pagado`; ingreso `pendiente → confirmado`.
- `entry_omisiones`: plantillas borradas a mano en un período dado, para que
  la regeneración automática no las vuelva a crear.
- `period_generations`: marca qué períodos ya generaron sus movimientos desde
  plantillas, para no repetir el trabajo en cada visita a `/mes-actual`.
- `fund_initial_balance`, `fund_balance_checks`, `fund_movements`: saldo
  inicial del fondo mutuo, controles de saldo informado (de los que se infiere
  el interés generado) y el libro mayor de movimientos confirmados
  (`tipo`: `ingreso | egreso | interes | saldo_inicial`).

## Arquitectura y convenciones del código

### Ciclo de facturación 27→26 (no el mes calendario)

Concepto central de toda la app: los períodos van del día 27 de un mes al 26
del siguiente, y se **nombran por el mes en que terminan** (el ciclo
27/jul–26/ago es "agosto"). Toda la lógica de fechas vive en `src/lib/period.ts`
(`getInicioPeriodoActual`, `getFinPeriodo`, `fechaDeEntry`, `ordenDiaPeriodo`,
`estaVencido`, etc.) — usar siempre esas funciones en vez de reimplementar
cálculos de fecha/período a mano.

### Server Actions como capa de negocio

No hay API REST propia para las mutaciones del CRUD principal: las páginas
(Server Components async) leen directo de Supabase, y las escrituras van en
Server Actions (`'use server'`) centralizadas en `src/lib/actions/entries.ts`,
compartidas entre `/mes-actual` y `/extras`. Los `<form action={...}>` pasan
un campo oculto `_path` para que la Server Action sepa qué ruta revalidar
con `revalidatePath`. Los endpoints en `src/app/api/*` son solo para lo que
un Server Action no puede cubrir: el callback de OAuth, el cron diario
(autenticado con `CRON_SECRET` por header o query param) y descargas de
archivos (Excel/CSV).

### Regla del fondo: la plata sale al "rescatar", no al "pagar"

El movimiento de egreso en `fund_movements` se crea la primera vez que un
gasto llega a `rescatado` o `pagado` (lo que pase primero) — es cuando la
plata realmente sale del fondo mutuo. Revertir a `pendiente` borra ese
movimiento. Mismo patrón simétrico para ingresos con `confirmado`. Cualquier
cambio de estado que toque el fondo debe revalidar también `/` y `/fondo`
además de la página de origen (ver `revalidarMesActual` en `entries.ts`).

### Generación de movimientos y omisiones

`/mes-actual` genera los movimientos del período vigente a partir de las
plantillas activas en cada visita, pero es idempotente y barato: primero
chequea `period_generations` y si el período ya está marcado, no hace nada
más. Si el usuario borra a mano un movimiento generado desde plantilla, se
anota en `entry_omisiones` para que no reaparezca en el próximo render.
Borrar/editar una plantilla nunca toca movimientos ya generados, y viceversa
— son filas independientes por diseño, reforzado a nivel de base de datos.

### Server vs. Client Components

Patrón dominante: página `async` (Server Component) que hace las consultas a
Supabase y pasa los datos + las Server Actions como props a un componente
`'use client'` que maneja filtros en vivo, edición inline y estados
optimistas (ver `useFilasOptimistas.ts`, `GastosEntriesTable.tsx`,
`GastosTemplateTable.tsx`). Los filtros de texto se resuelven en cliente sin
recargar; los filtros de estado/rango de fecha se resuelven vía
`searchParams` (recargan la página).

### Autenticación

`middleware.ts` protege todas las rutas salvo `/login` y `/api/*` (las de
`/api/*` manejan su propia auth). `getAuthUser` y `getCurrentAccountId`
(`src/lib/supabase/account.ts`) están envueltos en `cache()` de React para
memoizar por request — usarlos siempre en vez de llamar
`supabase.auth.getUser()` directo, para no repetir el viaje de red.

### Componentes UI reutilizables

`src/components/ui/` tiene las piezas genéricas (`Layout.tsx` con
`PageHeader`/`Section`/`Aviso`, `Money.tsx` para formato de montos,
`StatusPill.tsx`, `FiltrosPanel.tsx`, `SearchInput.tsx`, `Paginador.tsx`,
`FormularioAlta.tsx`, `NuevoPanel.tsx`). Preferir estos antes de crear
markup nuevo para casos ya cubiertos. La paleta de color tiene significado
semántico fijo en `tailwind.config.js`: `pine` (verde) = fondo/ingresos/
confirmado, `brick` (rojo) = egresos, `ochre` = estado intermedio/avisos.

### Comentarios

El código comenta el *por qué*, no el *qué* — sobre todo decisiones de
negocio no obvias (ej. por qué el egreso se registra al rescatar y no al
pagar) y fixes de bugs concretos con su causa. Seguir ese estilo en vez de
comentarios descriptivos genéricos.

## Variables de entorno

Ver `.env.example`: credenciales de Supabase (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — esta última
solo se usa server-to-server para el cron, nunca debe llegar al cliente),
`TELEGRAM_BOT_TOKEN` y `CRON_SECRET` (protege `/api/cron/*`).
