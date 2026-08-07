# finanzas-py

Aplicación de gestión financiera familiar: ingresos, gastos, plantillas
mensuales, control del fondo mutuo y previsiones a 12 meses.

## Estado del proyecto

**Etapa 1 — completada:** infraestructura base.
- Next.js 14 + TypeScript + Tailwind
- Autenticación con Google vía Supabase, con soporte para vincular un
  segundo correo Gmail a la misma cuenta familiar (`linkIdentity`)
- Schema completo de base de datos con Row Level Security (`supabase/schema.sql`), en esquema dedicado `finanzas_py` para convivir con otras apps del mismo proyecto Supabase
- Configuración: métodos de pago, categorías, destinatarios de Telegram
- Endpoint de cron protegido por secreto, listo para recibir la llamada
  diaria de cron-job.org (lógica de negocio completa se agrega en Etapa 5)

**Etapa 2 — completada:** plantillas y aplicación mensual.
- `/plantillas`: alta, edición (día/monto/método/categoría) y activación de plantillas de gastos e ingresos mensuales
- `/mes-actual`: respeta el ciclo de facturación 27–26; botón para generar los movimientos del período vigente a partir de las plantillas activas (sin duplicar si ya existen)
- Edición de día/monto por movimiento del mes sin afectar la plantilla
- Estados de gasto: pendiente → rescatado → pagado (con reversa)
- Estados de ingreso: pendiente → confirmado (con reversa)
- Al marcar un gasto como "pagado" o un ingreso como "confirmado", se genera automáticamente el movimiento correspondiente en el libro mayor del fondo (`fund_movements`); si se revierte el estado, el movimiento se elimina para mantener el saldo consistente
- **Fix de autenticación**: se agregó `middleware.ts`, que obliga a iniciar sesión para cualquier página que no sea `/login`, y redirige al dashboard si ya estás logueado y entrás a `/login`. También se agregó el botón de "Cerrar sesión" (con el email de la cuenta activa) en el sidebar, y se separó el layout para que `/login` no muestre el menú lateral.
- **Fix de creación de cuenta**: la primera cuenta familiar y el vínculo de correos adicionales ahora se crean con funciones de base de datos `SECURITY DEFINER` (`create_account_for_user`, `link_email_to_my_account`) en vez de inserts directos, evitando un problema de RLS+RETURNING en la primera fila de un usuario nuevo.

**Etapa 3 — completada:** extras y control de saldo del fondo.
- `/extras`: alta de gastos e ingresos puntuales (con fecha de vencimiento/aplicación, no plantilla), mismos estados y misma lógica de libro mayor que los movimientos regulares
- `/fondo`: carga única de saldo inicial; registro del saldo real informado por el usuario con cálculo automático del interés generado (diferencia contra el saldo calculado por el sistema); historial de chequeos de saldo; libro mayor de los últimos movimientos del fondo
- Las acciones de edición/estado de movimientos (`updateExpenseEntry`, `cambiarEstadoGasto`, etc.) se centralizaron en `src/lib/actions/entries.ts`, compartidas entre `/mes-actual` y `/extras`
- Fix de alineación de columnas en la tabla de plantillas de gastos (se pasó de una tabla HTML con `colSpan` a un grid CSS por fila)

**Próximas etapas:**
4. Dashboard con gráficos, previsiones a 12 meses, extracto descargable
5. Lógica completa de notificaciones diarias por Telegram

## Puesta en marcha

### 1. Supabase
> Este proyecto está pensado para **compartir un proyecto de Supabase existente**
> (por ejemplo `vacamanager` o `irp-py`) sin afectar esas apps: todas las
> tablas de finanzas-py viven en su propio esquema de Postgres, `finanzas_py`,
> separado de `public`. También podés usar un proyecto nuevo si preferís;
> el esquema dedicado funciona igual en ambos casos.

1. Elegí el proyecto de Supabase a usar (existente o nuevo).
2. En el SQL Editor, ejecutar el contenido de `supabase/schema.sql`. Esto crea el esquema `finanzas_py` y todas las tablas ahí adentro — no toca nada de `public` ni de otros esquemas.
3. **Paso obligatorio y fácil de olvidar**: ir a Project Settings > API > "Exposed schemas" y agregar `finanzas_py` a la lista (sin sacar `public`, que puede estar en uso por las otras apps). Sin este paso, el cliente de Supabase no puede leer ni escribir estas tablas.
4. En Authentication > Providers, habilitar Google y cargar el Client ID / Secret de Google Cloud (si ya está habilitado por otra app del mismo proyecto, no hay que volver a configurarlo).
5. En Authentication > URL Configuration, agregar como Redirect URL:
   `https://<tu-dominio>.vercel.app/api/auth/callback` (agregarla a la lista existente, no reemplaza las de las otras apps).

> **Nota sobre reutilizar el proyecto:** la tabla `auth.users` de Supabase es
> compartida por todas las apps del mismo proyecto (es la única parte no
> aislada por esquema). Esto no genera conflicto: si te logueás con el mismo
> Gmail que usás en vacamanager o irp-py, simplemente ya existe ese usuario
> en `auth.users`, y finanzas-py de todos modos solo ve y escribe filas de
> `finanzas_py.account_users` — sus propios datos, sin mezclarse con las
> otras apps.

### 2. Variables de entorno
Copiar `.env.example` a `.env.local` y completar con los valores de tu proyecto de Supabase y tu bot de Telegram.

### 3. Instalación local
```bash
npm install
npm run dev
```

### 4. Deploy en Vercel
1. Subir este repositorio a GitHub.
2. Importar el repo en Vercel.
3. Cargar las mismas variables de entorno del `.env.local` en la configuración del proyecto en Vercel.
4. Deploy.

### 5. Cron job (cron-job.org)
1. Crear una tarea nueva apuntando a:
   `https://<tu-dominio>.vercel.app/api/cron/notificar-vencimientos`
2. Agregar el header `Authorization: Bearer <CRON_SECRET>` (el mismo valor que pusiste en la variable de entorno `CRON_SECRET`).
3. Programar el horario deseado (ej. todos los días a las 8:00).

### 6. Vincular un segundo correo Gmail a la misma cuenta
Una vez logueado con el primer correo, desde Configuración (se habilita en Etapa 2) se puede invocar `linkIdentity` para sumar el segundo Gmail a la misma cuenta familiar, sin crear una cuenta separada.
