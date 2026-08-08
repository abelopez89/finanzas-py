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
- **Fix de fondo**: el egreso del fondo ahora se registra en el momento del "rescate" (que es cuando la plata realmente sale del fondo mutuo), no al marcar "pagado" — antes solo se registraba al pagar, lo cual no reflejaba el saldo real del fondo. Una vez rescatado, el monto queda bloqueado para edición.

**Etapa 4 — completada:** dashboard, previsiones y extracto.
- `/` (Dashboard): saldo actual del fondo, gráfico de ingresos vs. egresos de los últimos 6 períodos, y tabla de próximos vencimientos del período vigente
- `/previsiones`: proyección de saldo a 12 períodos, asumiendo que las plantillas activas se repiten; arranca del saldo real ajustado por lo pendiente del período actual; alerta si el saldo proyectado se vuelve negativo, con la fila resaltada en rojo (igual que el Excel anterior); gráfico de evolución
- `/extracto`: descarga en CSV de los movimientos confirmados del fondo, filtrado por rango de fechas

**Nota de diseño**: a diferencia del Excel anterior, las plantillas de este sistema no tienen banderas mes a mes (como las columnas Ene–Dic para "Cuota Rafa"/"Cuota Benja" aplicando solo Feb–Nov). Por ahora todas las plantillas activas se proyectan como recurrentes en todos los períodos. Si hace falta ese nivel de detalle estacional, se puede agregar como mejora — avisame si lo querés para la próxima etapa.

**Ajustes post-Etapa 4:**
- **Menú simplificado**: Métodos de pago, Categorías y Telegram ahora viven bajo un solo ítem "Configuración" (`/configuracion`, con pestañas internas). El sidebar bajó de 10 a 8 ítems.
- **Auto-generación en Mes Actual**: al entrar a `/mes-actual`, si el período vigente todavía no tiene movimientos generados desde las plantillas, se crean solos (mismo mecanismo idempotente que el botón manual, que sigue disponible por si se agrega una plantilla nueva después).
- **Filtros y totales en Mes Actual y Extras**: ambas pantallas ahora tienen filtro por nombre, estado y rango de fechas/días, con el total filtrado mostrado arriba de cada tabla.
- **Gráfico de categorías en el Dashboard**: torta con la distribución de gastos del período vigente por categoría.
- **Extracto renombrado a Movimientos** (`/movimientos`): vista unificada de TODOS los gastos e ingresos de la cuenta (regulares y extra), con filtros por nombre/tipo/origen/estado/fecha, totales, y descarga en **Excel** (antes era CSV) reflejando los mismos filtros aplicados.

**Ajustes adicionales:**
- **Movimientos ahora muestra solo confirmados**: gastos pagados e ingresos confirmados únicamente (antes mostraba todo, incluyendo pendientes). Se sacó el filtro de "Estado" de la pantalla porque ya no aporta (todo lo que aparece está confirmado por definición).
- **Previsiones ahora suma extras futuros**: si cargás un gasto o ingreso extra en `/extras` con una fecha futura, se va a sumar automáticamente al período que le corresponde en la proyección de 12 meses (se marca con una etiqueta "+ extra" en la tabla). Esto requirió corregir un bug: el campo `periodo` de un extra se calculaba con la fecha de HOY en vez de con la fecha de vencimiento/aplicación elegida, por lo que un extra futuro terminaba mal ubicado.
- **Eliminar en Mes Actual**: los gastos/ingresos generados desde plantillas ahora se pueden borrar individualmente (solo si están en estado "pendiente" — si ya está rescatado/pagado/confirmado hay que revertir primero). Borrar un movimiento del mes nunca toca la plantilla de origen, y editar/desactivar una plantilla nunca afecta movimientos ya generados o confirmados — son filas independientes por diseño, y la base de datos lo refuerza a nivel estructural.
- **Saldo inicial editable**: ahora se puede corregir el monto/fecha del saldo inicial del fondo después de cargado (antes era de una sola vez, sin vuelta atrás). Al editarlo, el movimiento correspondiente en el libro mayor (`fund_movements`) se actualiza junto con él, para que el saldo del fondo siga siendo consistente.
- **Orden en Mes Actual y Plantillas**: los gastos ahora se ordenan por día (respetando el ciclo 27→26, no el orden numérico 1-31), después por método de pago, y después por nombre. Los ingresos se ordenan por día y nombre (no tienen método de pago).
- **Buscador en vivo en Plantillas**: las tablas de gastos e ingresos mensuales ahora filtran mientras se escribe, sin recargar la página (se extrajo la lógica a componentes cliente `GastosTemplateTable` e `IngresosTemplateTable`).
- **Menú reordenado**: Dashboard, Mes actual, Extras, Fondo mutuo, Movimientos, Plantillas, Previsiones, Configuración.

**Reorganización mayor (post-Etapa 4, ronda 2):**
- **Buscador en vivo en Mes Actual**: igual que en Plantillas, ahora las tablas de gastos e ingresos del período filtran por nombre al instante. Los filtros de estado y rango de día siguen siendo por botón (consultan la base directamente).
- **Pendientes de meses anteriores visibles en Mes Actual**: si arrancó un período nuevo y quedó algo sin resolver del anterior (por ejemplo, un gasto que nunca se rescató), ahora aparece en una sección aparte arriba de todo, con la misma posibilidad de editar/cambiar estado/eliminar — no hace falta ninguna pantalla adicional para encontrarlo.
- **Fondo mutuo y Movimientos se fusionaron**: `/movimientos` ya no existe como pantalla separada; todo su contenido (filtros, totales, descarga Excel) ahora vive dentro de `/fondo`, debajo del saldo actual y del registro de saldo del fondo. Además, la lista de movimientos ahora también incluye los intereses y el saldo inicial (antes esos solo se veían en la sección vieja de "últimos movimientos" del fondo, separados de gastos/ingresos).
- **Saldo inicial trasladado a Configuración**: la carga/edición del saldo inicial del fondo ahora es una pestaña más dentro de Configuración, no una sección de la pantalla de Fondo.
- **Plantillas trasladado a Configuración**: ya no es un ítem del menú principal — ahora es la primera pestaña dentro de Configuración (`/configuracion/plantillas`).
- **Menú final**: Dashboard, Mes actual, Extras, Fondo mutuo, Previsiones, Configuración (con pestañas: Plantillas, Métodos de pago, Categorías, Saldo inicial, Telegram).

**Etapa 5 — completada:** notificaciones diarias por Telegram.
- `src/lib/avisos.ts` arma el mensaje: gastos que vencen hoy, atrasados sin rescatar, total a rescatar antes del mediodía y saldo del fondo. Calcula la fecha real de cada gasto (los extras la tienen explícita; los regulares se derivan del período 27–26 y el día).
- `GET /api/cron/notificar-vencimientos` recorre las cuentas con destinatarios activos y envía. Autenticación por `Authorization: Bearer <CRON_SECRET>` o `?token=<CRON_SECRET>`.
- Si no hay vencimientos ni atrasados, **no manda nada**: un aviso diario que llega siempre se vuelve ruido que se ignora.
- Un destinatario que falle (por ejemplo, alguien que bloqueó el bot) no corta el envío a los demás; el resultado detallado vuelve en la respuesta del endpoint.
- Botón "Enviar aviso de prueba" en Configuración → Telegram, para verificar token y chat_id sin esperar al horario del cron.

**Alcance original completo.** Todos los requisitos funcionales del pedido inicial están implementados.

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
