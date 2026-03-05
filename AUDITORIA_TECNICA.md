# AUDITORÍA TÉCNICA PADDYFLOW — Seguridad, Integridad y Performance

**Fecha:** Marzo 2025  
**Objetivo:** Identificar vulnerabilidades, riesgos de integridad y problemas de performance para hardening antes de venta.

---

## 1. SEGURIDAD

### 1.1 JWT

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/middleware/auth.ts` L7 | `JWT_SECRET` usa fallback `'dev-secret-change-me'` si no está en env. En producción podría usarse secreto débil. | **Alto** | Fail-fast: `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required')`. No fallback en prod. |
| `server/src/middleware/auth.ts` L8 | `JWT_EXPIRES_IN` configurable vía env, default `'7d'`. | Bajo | OK. Documentar en `.env.example`. |
| `server/src/middleware/auth.ts` L21 | `expiresIn` aplicado en `jwt.sign()`. | - | OK |

### 1.2 CORS

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/index.ts` L18 | `cors({ origin: true, credentials: true })` permite **cualquier origen**. | **Alto** | Restringir: `origin: process.env.APP_BASE_URL?.split(',') ?? ['http://localhost:5173']`. No `*` en prod. |

### 1.3 Rate limiting

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/index.ts` | No hay middleware de rate limiting. | **Alto** | Añadir `express-rate-limit` en `/api/auth` (login/register) y opcionalmente en rutas sensibles. |

### 1.4 Webhook Stripe

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/index.ts` L20-24 | Webhook montado con `express.raw()` antes de `express.json()`. | - | OK |
| `server/src/routes/stripeWebhook.ts` L131-140 | Firma validada con `stripe.webhooks.constructEvent(req.body, sig, webhookSecret)`. | - | OK |
| `server/src/routes/stripeWebhook.ts` L28-48, L144-154 | Idempotencia con `billing_events` y unique en `stripeEventId`. | - | OK |
| `server/src/routes/stripeWebhook.ts` L10 | `webhookSecret` con `!` (non-null assertion). Si falta, responde 500. | Medio | Verificar explícitamente al boot y documentar. |

### 1.5 req.user y passwordHash

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/middleware/auth.ts` L54-84 | `db.select().from(users)` trae todas las columnas, incluido `passwordHash`. `req.user = { ...userRow, tenant }` incluye `passwordHash`. | **Alto** | Usar `select({ id, tenantId, email, name, role, isActive, createdAt, updatedAt })` y excluir `passwordHash` de `req.user`. |
| `server/src/types/express.d.ts` | Tipo `User & { tenant }` incluye `passwordHash`. | Medio | Definir `UserSafe` sin `passwordHash` para `req.user`. |
| `server/src/routes/tenants.ts` L25 | Destructuring `passwordHash` antes de enviar. | - | Mitiga en ese endpoint, pero no en otros. |

### 1.6 Token storage (cliente)

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `client/src/context/AuthContext.tsx` L12-19 | Token en `localStorage` (`paddyflow_token`). Vulnerable a XSS. | Medio | Preferir cookie `HttpOnly` + `Secure` + `SameSite`. Si no viable ahora: migrar a `sessionStorage` + documentar limitación. |

---

## 2. INTEGRIDAD

### 2.1 Numeración proformas/facturas

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/routes/sales.ts` L109-125 | Proformas: carga todas las proformas del tenant, calcula max en memoria, genera `PF-XXXXXX`. Sin transacción. Race condition. | **Alto** | Tabla `proforma_counters` o transacción con `SELECT ... FOR UPDATE` + contador. |
| `server/src/routes/sales.ts` L238-265 | Facturas: `SELECT` secuencia, `UPDATE currentNumber`, `INSERT` documento. Sin transacción. Dos requests concurrentes pueden duplicar número. | **Alto** | Transacción con `SELECT ... FOR UPDATE` en secuencia antes de incrementar. |

### 2.2 /register – tenant + user

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/routes/auth.ts` L50-84 | Tenant y usuario en dos `INSERT` separados, sin transacción. Si falla el segundo, queda tenant huérfano. | **Alto** | `db.transaction()` para insertar tenant + usuario atómicamente. |

### 2.3 Unique constraints en emails

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/db/schema.ts` L167-169 | Solo `index('users_email_tenant_idx')` en `(email, tenantId)`. No hay `unique`. | **Alto** | Añadir `unique('users_email_tenant_unique').on(table.email, table.tenantId)`. |

### 2.4 Validación de transiciones de estado

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/routes/sales.ts` | Documentos se crean como `ISSUED`. No hay flujo DRAFT→ISSUED→CANCELED. | Bajo | Si se añaden PATCH para cambiar estado, validar transiciones permitidas. |

---

## 3. PERFORMANCE

### 3.1 Numeración

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/routes/sales.ts` L109-117 | Proformas: carga todas las proformas para calcular siguiente número. | **Alto** | Tabla de contadores o `MAX(internalNumber)` en SQL. |
| `server/src/routes/sales.ts` L238-265 | Facturas: usa contador en `dgii_sequences`. | - | OK. Falta transacción. |

### 3.2 Filtros: SQL vs memoria

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/routes/reports.ts` L35-49 | `from`/`to` aplicados en memoria con `filter()` después de cargar todos los documentos. | **Alto** | Añadir `and(gte(salesDocuments.issueDate, from), lte(salesDocuments.issueDate, to))` en la query. |

### 3.3 Índices

| Archivo | Hallazgo | Impacto | Recomendación |
|---------|----------|---------|---------------|
| `server/src/db/schema.ts` L251-254 | `sales_documents`: índices en `tenantId` y `(tenantId, kind)`. No hay índice en `issueDate` ni `createdAt` compuesto. | Medio | `index('sales_documents_tenant_created_idx').on(table.tenantId, table.createdAt)`, `index('sales_documents_tenant_issue_date_idx').on(table.tenantId, table.issueDate)`. |

---

## 4. RESUMEN DE PRIORIDADES

| Prioridad | Cantidad | Áreas |
|-----------|----------|-------|
| **Alto** | 11 | JWT fallback, CORS, rate limit, req.user passwordHash, numeración sin transacción (proformas + facturas), register sin transacción, unique email, proformas load-all, filtros en memoria |
| **Medio** | 5 | webhookSecret check, tipo req.user, token localStorage, índices sales_documents |
| **Bajo** | 2 | Validación transiciones estado, documentación JWT |

---

## 5. CHECKLIST HARDENING (DoD Fase A)

- [ ] JWT: sin fallback, fail-fast si falta JWT_SECRET
- [ ] CORS: restringido a APP_BASE_URL + localhost dev
- [ ] Rate limiting en login/register
- [ ] Webhook Stripe: firma validada (ya OK), raw body (ya OK), idempotencia (ya OK)
- [ ] req.user sin passwordHash; responses nunca exponen hashes
- [ ] Token: cookie httpOnly o sessionStorage + documentación
- [ ] Register: transacción tenant + user
- [ ] Unique constraint (tenantId, email) en users
- [ ] Numeración proformas: transaccional
- [ ] Numeración facturas: transacción con FOR UPDATE
- [ ] Filtros from/to en SQL (reports)
- [ ] Índices compuestos en sales_documents
