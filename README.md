# Prons Security

Adaptación del sitio estático existente de Prons Seguridad para correr como proyecto full-stack simple sobre Netlify, manteniendo la identidad visual actual y agregando formulario productivo, Netlify Functions, Netlify DB, auth de admin, recordatorios por email y WhatsApp.

El build publica un `dist/` generado automáticamente a partir del frontend existente y de las nuevas páginas estáticas, para no exponer archivos internos del workspace como `lib/`, `scripts/` o `package.json`.

## Qué incluye

- Landing pública existente preservada en `index.html`
- Formulario productivo en `/formulario`
- Login admin en `/admin/login`
- Panel admin en `/admin`
- Netlify Functions para formulario, auth, clientes y recordatorios
- Persistencia en Netlify DB (Postgres/Neon)
- Email HTML alineado con la estética del sitio
- Integración desacoplada de WhatsApp Cloud API con modo mock
- Modo desarrollo tolerante a falta de credenciales externas

## Requisitos previos

- Node.js `20.12.2` o superior
- npm `10+` recomendado
- Cuenta de Netlify
- Proyecto vinculado a Netlify para usar Netlify DB en forma simple

La máquina usada para preparar este cambio tenía Node `16.20.2`, por eso no pude ejecutar `netlify dev` ni verificar runtime real localmente desde acá. El stack quedó preparado para Node 20.12.2+, que es el mínimo exigido hoy por Netlify DB y Netlify CLI según la documentación oficial.

Fuentes oficiales usadas:

- Netlify DB: https://docs.netlify.com/build/data-and-storage/netlify-db/
- Netlify Functions: https://docs.netlify.com/build/functions/get-started/
- Variables de entorno en functions: https://docs.netlify.com/build/functions/environment-variables/

## Instalación

1. Instalar Node `20.12.2+`.
2. Desde la raíz del proyecto, correr:

```bash
npm install
```

3. Crear archivo `.env` a partir de `.env.example`.

## Variables de entorno necesarias

### Obligatorias para admin

- `ADMIN_EMAIL`
- `ADMIN_USER`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`

Generar hash de contraseña:

```bash
npm run auth:hash -- "tu-password-segura"
```

### Base de datos

- `NETLIFY_DATABASE_URL`

En la práctica, Netlify la crea automáticamente al usar Netlify DB. También puede quedar disponible al correr `npx netlify db init` o al usar `npx netlify dev` en un sitio ya vinculado.

### Email

- `RESEND_API_KEY`
- `EMAIL_FROM`

Si faltan, el flujo no se rompe: la function registra el cliente y el servicio de email queda en modo mock.

### WhatsApp

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_FORM_SUBMITTED`
- `WHATSAPP_TEMPLATE_REMINDER`
- `WHATSAPP_TEMPLATE_LANG` opcional, por defecto `es_AR`

Si faltan, el flujo no se rompe: la function registra el cliente y WhatsApp queda en modo mock.

## Inicializar Netlify DB

Opción recomendada por Netlify:

```bash
npx netlify login
npx netlify link
npx netlify db init
```

Luego aplicar la migración:

```bash
npm run db:migrate
```

El script intenta resolver `NETLIFY_DATABASE_URL` desde `.env` y, si no está, consulta `npx netlify env:get NETLIFY_DATABASE_URL --plain`.

La tabla creada es `clients` con estos campos principales:

- `id`
- `nombre`
- `email`
- `telefono`
- `tipo_proyecto`
- `solucion`
- `datos_extra`
- `source`
- `status`
- `created_at`
- `updated_at`

SQL base: `migrations/001_create_clients.sql`

## Cómo iniciar localmente

1. Tener `.env` completo.
2. Tener el sitio vinculado a Netlify.
3. Levantar el entorno:

```bash
npm run dev
```

Netlify Dev va a servir:

- sitio público
- rutas bonitas como `/formulario`
- functions bajo `/api/*`

URL local esperada: `http://localhost:8888`

## Cómo probar el formulario

1. Abrir `http://localhost:8888/formulario`
2. Elegir tipo de proyecto
3. Elegir solución
4. Completar nombre, email y teléfono
5. Enviar

Resultado esperado:

- se crea un registro en `clients`
- `status` inicial queda en `nuevo`
- se intentan disparar email y WhatsApp
- si faltan credenciales externas, se registra todo igual y los envíos quedan mockeados

## Cómo ingresar al admin

1. Abrir `http://localhost:8888/admin/login`
2. Usar `ADMIN_EMAIL` o `ADMIN_USER`
3. Ingresar la contraseña cuyo hash configuraste en `ADMIN_PASSWORD_HASH`

El panel permite:

- listar clientes
- paginar
- buscar por nombre
- enviar recordatorio por email
- enviar recordatorio por WhatsApp
- cerrar sesión

La sesión usa cookie `httpOnly` firmada.

## Deploy en Netlify

Flujo simple recomendado:

1. Crear repo GitHub y subir este proyecto.
2. Importar el repo en Netlify.
3. Configurar variables de entorno en Netlify UI.
4. Confirmar que el sitio esté vinculado a Netlify DB o correr `npx netlify db init`.
5. Ejecutar la migración contra la base correspondiente.
6. Hacer push a GitHub.

Con eso, Netlify debería reconstruir y publicar automáticamente en cada push.

## Endpoints creados

- `POST /api/create-client`
- `GET /api/admin-session`
- `POST /api/admin-login`
- `POST /api/admin-logout`
- `GET /api/list-clients`
- `GET /api/search-clients`
- `GET /api/client-detail?id=...`
- `POST /api/send-email-reminder`
- `POST /api/send-whatsapp-reminder`

## Estructura agregada

```text
admin/
  index.html
  login/index.html
assets/js/
  admin-login.js
  admin-panel.js
  formulario.js
formulario/index.html
lib/
netlify/functions/
migrations/
scripts/
```

## Qué queda mockeado si faltan credenciales reales

- envío de email
- envío de WhatsApp

El alta del cliente en base y el flujo del formulario siguen funcionando.

## Nota sobre el email HTML y el PDF

No había un PDF adjunto ni un PDF local disponible en el workspace al momento de esta adaptación. Por eso el contenido base del email quedó redactado a partir de la identidad actual del sitio y su mensaje comercial, con estructura preparada para reemplazar el copy fácilmente en `lib/email.js` cuando tengas el PDF definitivo.
