# Prons Security

Adaptación del sitio estático existente de Prons Seguridad para correr como proyecto full-stack simple sobre Netlify, manteniendo la identidad visual actual y agregando formulario productivo, Netlify Functions, base Postgres/Neon, auth de admin, recordatorios por email y WhatsApp, y ahora un inbox MVP de WhatsApp Cloud API dentro del admin.

El build publica un `dist/` generado automáticamente a partir del frontend existente y de las nuevas páginas estáticas, para no exponer archivos internos del workspace como `lib/`, `scripts/` o `package.json`.

## Qué incluye

- Landing pública existente preservada en `index.html`
- Formulario productivo en `/formulario`
- Login admin en `/admin/login`
- Panel admin en `/admin`
- WhatsApp Inbox en `/admin/whatsapp`
- Netlify Functions para formulario, auth, clientes y recordatorios
- Webhook oficial de WhatsApp Cloud API y bandeja de conversaciones
- Persistencia en Postgres/Neon
- Email HTML alineado con la estética del sitio
- Integración desacoplada de WhatsApp Cloud API con modo mock
- Modo desarrollo tolerante a falta de credenciales externas

## Requisitos previos

- Node.js `20.12.2` o superior
- npm `10+` recomendado
- Cuenta de Netlify
- Cuenta de Netlify
- Base Postgres o Neon disponible

La máquina usada para preparar este cambio tenía Node `16.20.2`, por eso no pude ejecutar `netlify dev` ni verificar runtime real localmente desde acá. El stack quedó preparado para Node 20.12.2+, que es el mínimo exigido hoy por Netlify CLI y el driver usado para Postgres/Neon.

Fuentes oficiales usadas:

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

Debe configurarse manualmente con la connection string de tu base Postgres o Neon tanto en local como en Netlify.

### Email

- `RESEND_API_KEY`
- `EMAIL_FROM`

Si faltan, el flujo no se rompe: la function registra el cliente y el servicio de email queda en modo mock.

### WhatsApp

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_API_VERSION` opcional, por defecto `v23.0`
- `WHATSAPP_APP_SECRET` opcional pero recomendado para validar firma del webhook
- `WHATSAPP_TEMPLATE_FORM_SUBMITTED`
- `WHATSAPP_TEMPLATE_REMINDER`
- `WHATSAPP_TEMPLATE_LANG` opcional, por defecto `es_AR`

Si faltan, el flujo no se rompe: la function registra el cliente y WhatsApp queda en modo mock.

## Inicializar la base de datos

Una vez creada la base y configurada `NETLIFY_DATABASE_URL`, aplicar la migración:

```bash
npm run db:migrate
```

El script intenta resolver `NETLIFY_DATABASE_URL` desde `.env` y, si no está, consulta `npx netlify env:get NETLIFY_DATABASE_URL --plain`.

Las tablas principales ahora son:

- `clients`
- `admin_users`
- `whatsapp_conversations`
- `whatsapp_messages`

Migraciones base:

- `migrations/001_create_clients.sql`
- `migrations/002_create_whatsapp_inbox.sql`

## Cómo iniciar localmente

1. Tener `.env` completo.
2. Tener `NETLIFY_DATABASE_URL` configurada.
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
- abrir el inbox en `/admin/whatsapp`
- cerrar sesión

La sesión usa cookie `httpOnly` firmada.

## WhatsApp Inbox MVP

La nueva bandeja en `/admin/whatsapp` permite:

- ver conversaciones ordenadas por último mensaje
- buscar por nombre o teléfono
- filtrar solo no leídos
- abrir el historial del chat
- marcar como leída una conversación al abrirla
- responder mensajes desde el panel
- registrar qué usuario envió cada respuesta

### Limitaciones actuales del MVP

- pensado para mensajes de texto y payloads básicos
- estados de entrega se guardan, pero no hay UI avanzada de ticks
- no incluye multimedia compleja
- no incluye asignación avanzada ni notas internas
- para enviar fuera de la ventana de 24 horas hay que usar templates aprobados por Meta; el panel devuelve un error claro pero no envía template todavía

## Usuarios vendedores / admin

El proyecto sigue aceptando el admin actual por variables de entorno:

- `ADMIN_EMAIL`
- `ADMIN_USER`
- `ADMIN_PASSWORD_HASH`

Además, ahora existe `admin_users` para vendedores/admin persistidos en DB.

### Crear hash de contraseña

```bash
npm run auth:hash -- "tu-password-segura"
```

### Crear un vendedor manualmente en SQL

```sql
INSERT INTO admin_users (email, username, password_hash, role, display_name)
VALUES (
  'vendedor@prons.com.ar',
  'vendedor1',
  'PEGAR_HASH_GENERADO',
  'seller',
  'Vendedor 1'
);
```

Roles permitidos hoy:

- `admin`
- `seller`

## Deploy en Netlify

Flujo simple recomendado:

1. Crear repo GitHub y subir este proyecto.
2. Importar el repo en Netlify.
3. Configurar variables de entorno en Netlify UI.
4. Configurar `NETLIFY_DATABASE_URL` en Netlify con la base correspondiente.
5. Ejecutar la migración contra la base correspondiente.
6. Hacer push a GitHub.

Con eso, Netlify debería reconstruir y publicar automáticamente en cada push.

## Configurar webhook en Meta

En Meta Developers, para el producto WhatsApp:

1. Abrir la configuración de Webhooks.
2. En `Callback URL` pegar:
   `https://TU-DOMINIO/.netlify/functions/whatsapp-webhook`
3. En `Verify token` pegar exactamente el valor de `WHATSAPP_VERIFY_TOKEN`.
4. Guardar y completar la verificación.
5. Suscribirse al menos a estos campos:
   - `messages`
   - `message_template_status_update` si después querés ampliar seguimiento
6. En la configuración del número, confirmar que el webhook quede apuntando al mismo endpoint.

### Verificación esperada del webhook

Meta va a llamar:

- `GET /.netlify/functions/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`

Si el token coincide, la function devuelve el `hub.challenge` en texto plano.

### Callback URL exacta para pegar en Meta

```text
https://mi-dominio/.netlify/functions/whatsapp-webhook
```

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
- `GET /api/whatsapp-conversations`
- `GET /api/whatsapp-conversation-detail?id=...`
- `POST /api/whatsapp-mark-read`
- `POST /api/whatsapp-send-message`
- `GET /.netlify/functions/whatsapp-webhook`
- `POST /.netlify/functions/whatsapp-webhook`

## Estructura agregada

```text
admin/
  index.html
  login/index.html
  whatsapp/index.html
assets/js/
  admin-login.js
  admin-panel.js
  admin-whatsapp.js
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

## Cómo probar local el inbox

1. Tener `.env` completo, incluyendo:
   - `NETLIFY_DATABASE_URL`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` si querés envío real
2. Aplicar migraciones:

```bash
npm run db:migrate
```

3. Levantar Netlify Dev:

```bash
npm run dev
```

4. Entrar a:
   - `http://localhost:8888/admin/login`
   - `http://localhost:8888/admin/whatsapp`

5. Verificar webhook local con una llamada manual:

```text
GET http://localhost:8888/.netlify/functions/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=1234
```

Debe responder `1234`.

6. Probar POST local con un payload de WhatsApp Cloud API hacia:

```text
POST http://localhost:8888/.netlify/functions/whatsapp-webhook
```

## Deploy del inbox

1. Subir cambios al repo.
2. Configurar en Netlify:
   - `NETLIFY_DATABASE_URL`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_API_VERSION`
   - `WHATSAPP_APP_SECRET` si querés validar firma
3. Ejecutar `npm run db:migrate` contra la base del entorno.
4. Deployar.
5. Configurar en Meta la URL pública del webhook.

## Pasos exactos para conectar Meta con el webhook

1. Definir en Netlify la variable `WHATSAPP_VERIFY_TOKEN` con un valor secreto tuyo.
2. Deployar el sitio y confirmar que responda:
   `https://TU-DOMINIO/.netlify/functions/whatsapp-webhook`
3. En Meta Developers > WhatsApp > Configuration > Webhooks:
   - `Callback URL`: `https://TU-DOMINIO/.netlify/functions/whatsapp-webhook`
   - `Verify token`: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
4. Confirmar la verificación.
5. Suscribir el campo `messages`.
6. Enviar un WhatsApp real al número conectado.
7. Abrir `/admin/whatsapp` y verificar que aparezca la conversación.
8. Responder desde el panel.

## Nota sobre el email HTML y el PDF

No había un PDF adjunto ni un PDF local disponible en el workspace al momento de esta adaptación. Por eso el contenido base del email quedó redactado a partir de la identidad actual del sitio y su mensaje comercial, con estructura preparada para reemplazar el copy fácilmente en `lib/email.js` cuando tengas el PDF definitivo.
