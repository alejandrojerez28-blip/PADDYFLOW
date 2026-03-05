# PaddyFlow

SaaS multi-tenant para gestión de procesos de arroz (pesadas, lotes, envíos, inventario, contabilidad).

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Cuenta Stripe (para billing)

---

## Configuración

### 1. Dependencias

```bash
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Base de datos

```sql
CREATE DATABASE paddyflow;
```

### 3. Variables de entorno

```bash
cp server/.env.example server/.env
```

Editar `server/.env`:

- `DATABASE_URL`: conexión PostgreSQL
- `JWT_SECRET`: clave para JWT
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`
- `APP_BASE_URL`: URL del cliente (ej. http://localhost:5173)
- `API_BASE_URL`: URL del servidor (ej. http://localhost:3001)

### 4. Migraciones

```bash
npm run db:migrate
```

---

## Configuración Stripe Billing

### 1. Productos y precios

1. Ir a [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Crear producto **Basic** (PLAN_BASIC):
   - Precio recurrente mensual en USD
   - Copiar el **Price ID** (ej. `price_xxx`) a `STRIPE_PRICE_BASIC`
3. Crear producto **Pro** (PLAN_PRO):
   - Precio recurrente mensual en USD
   - Copiar el **Price ID** a `STRIPE_PRICE_PRO`

### 2. Webhook

1. Ir a [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Añadir endpoint: `https://tu-dominio.com/api/stripe/webhook`
3. Eventos a escuchar:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copiar el **Signing secret** (whsec_xxx) a `STRIPE_WEBHOOK_SECRET`

Para desarrollo local, usar [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

### 3. Customer Portal

1. Ir a [Stripe Dashboard → Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal)
2. Activar el portal y configurar productos/planes visibles

### 4. Trial 15 días

- Se aplica solo si el tenant **nunca** ha tenido `stripeSubscriptionId` previo
- El flag `hadSubscriptionBefore` en `tenants` controla esto
- Tras la primera suscripción, no se vuelve a dar trial

---

## Ejecución

```bash
# Backend (puerto 3001)
npm run dev:server

# Frontend (puerto 5173) — en otra terminal
npm run dev:client

# O ambos
npm run dev
```

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| POST | /api/auth/register | No | Registrar tenant + usuario |
| POST | /api/auth/login | No | Login |
| GET | /api/tenants/me | Sí | Tenant y usuario actual |
| GET | /api/billing/status | Sí | Estado de suscripción |
| POST | /api/billing/checkout-session | Sí | Crear Checkout Session |
| POST | /api/billing/portal-session | Sí | Crear Customer Portal Session |
| POST | /api/stripe/webhook | No (firma) | Webhook Stripe |
| GET/POST | /api/tenants/fiscal-profile | Sí | Perfil fiscal RD |
| GET/POST | /api/dgii/sequences | Sí | Secuencias NCF/e-CF |
| GET | /api/sales/documents | Sí | Listar documentos |
| POST | /api/sales/proformas | Sí | Crear proforma |
| POST | /api/sales/invoices | Sí | Crear factura fiscal |
| GET | /api/reports/documents/export?format=xlsx | Sí | Export Excel |

---

## Ejemplos curl

### Registrar tenant + usuario

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123","name":"Admin","tenantName":"Mi Arrocera"}'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123","tenantId":"<TENANT_UUID>"}'
```

### Estado de billing (con token)

```bash
curl http://localhost:3001/api/billing/status \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Checkout session (con token)

```bash
curl -X POST http://localhost:3001/api/billing/checkout-session \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"plan":"basic"}'
```

---

## RD Tax Onboarding (República Dominicana)

### Flujo en 2 niveles

1. **Registro básico** (`country: "DO"`): tenant con `onboardingStatus=BASIC`, `taxMode=DO_DGII`. Acceso al dashboard en modo **read-only** para operaciones fiscales.
2. **Perfil fiscal**: POST `/api/tenants/fiscal-profile` con RNC, dirección, etc. → `onboardingStatus=FISCAL_PENDING`.
3. **Secuencias NCF/e-CF**: POST `/api/dgii/sequences` con rangos autorizados por DGII. Al tener al menos 1 secuencia activa + perfil completo → `onboardingStatus=FISCAL_READY`.

### Gating

- **Proforma**: siempre permitida (sin comprobante fiscal).
- **Factura fiscal**: requiere `FISCAL_READY`.
- **Compras/ventas/inventario**: requieren `FISCAL_READY` (excepto proforma).

### e-CF (Comprobante Fiscal Electrónico)

- Capa agnóstica de proveedor: `EcfProviderAdapter` con `sendInvoice`, `getStatus`, `downloadXml`.
- Proveedor actual: `NONE` (default) → error `PROVIDER_NOT_CONFIGURED`.
- Estructura lista para futuros: `PROVIDER_X`, `PROVIDER_Y`.
- Al emitir factura e-CF: se crea `ecf_transmissions` con status `PENDING_SEND`. Si provider=NONE, no se envía.

### Cómo probar (curl)

```bash
# 1. Registrar tenant RD
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password123","name":"Admin","tenantName":"Arrocera RD","country":"DO"}'

# 2. Login y guardar TOKEN + TENANT_ID

# 3. Completar perfil fiscal
curl -X POST http://localhost:3001/api/tenants/fiscal-profile \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"legalName":"Arrocera Demo SRL","rnc":"13123456789","fiscalAddress":"Calle 1, Santo Domingo","itbisRegistered":true,"defaultDocCurrency":"DOP"}'

# 4. Cargar secuencia e-CF
curl -X POST http://localhost:3001/api/dgii/sequences \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '[{"docType":"ECF_E31","startNumber":1,"endNumber":100}]'

# 5. Crear proforma (siempre)
curl -X POST http://localhost:3001/api/sales/proformas \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currency":"DOP","items":[{"itemName":"Arroz 50kg","qty":10,"unitPrice":25,"itbisRate":0}]}'

# 6. Crear factura fiscal (solo si FISCAL_READY)
curl -X POST http://localhost:3001/api/sales/invoices \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currency":"DOP","items":[{"itemName":"Arroz 50kg","qty":5,"unitPrice":25,"itbisRate":18}]}'
```

### Export Excel

```bash
curl "http://localhost:3001/api/reports/documents/export?format=xlsx" \
  -H "Authorization: Bearer <TOKEN>" \
  -o documentos.xlsx
```

---

## Gating por suscripción

El middleware `requireActiveSubscription` bloquea acciones **write** (POST/PUT/DELETE) cuando:

- `subscriptionStatus` ∈ `past_due`, `canceled`, `unpaid`, `incomplete_expired`
- No hay suscripción activa ni en trial

Respuesta: `402 Payment Required` con `code: "BILLING_BLOCKED"`.

Las lecturas (GET) siempre se permiten.

## Gating por onboarding fiscal

El middleware `requireFiscalReadyForWrites` bloquea facturas fiscales si `onboardingStatus != FISCAL_READY`. Proforma siempre permitida.
