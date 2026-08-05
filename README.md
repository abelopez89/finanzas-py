# finanzas-py

Aplicación de gestión financiera familiar: ingresos, gastos, plantillas
mensuales, control del fondo mutuo y previsiones a 12 meses.

## Estado del proyecto

**Etapa 1 — completada:** infraestructura base.
- Next.js 14 + TypeScript + Tailwind
- Autenticación con Google vía Supabase, con soporte para vincular un
  segundo correo Gmail a la misma cuenta familiar (`linkIdentity`)
- Schema completo de base de datos con Row Level Security (`supabase/schema.sql`)
- Configuración: métodos de pago, categorías, destinatarios de Telegram
- Endpoint de cron protegido por secreto, listo para recibir la llamada
  diaria de cron-job.org (lógica de negocio completa se agrega en Etapa 5)

**Próximas etapas:**
2. Plantillas de gastos/ingresos + aplicación mensual con estados (pendiente/rescatado/pagado, pendiente/confirmado)
3. Extras, carga de saldo del fondo y cálculo automático de interés
4. Dashboard con gráficos, previsiones a 12 meses, extracto descargable
5. Lógica completa de notificaciones diarias por Telegram

## Puesta en marcha

### 1. Supabase
1. Crear un proyecto en [supabase.com](https://supabase.com).
2. En el SQL Editor, ejecutar el contenido de `supabase/schema.sql`.
3. En Authentication > Providers, habilitar Google y cargar el Client ID / Secret de Google Cloud.
4. En Authentication > URL Configuration, agregar como Redirect URL:
   `https://<tu-dominio>.vercel.app/api/auth/callback` (y `http://localhost:3000/api/auth/callback` para desarrollo local).

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
