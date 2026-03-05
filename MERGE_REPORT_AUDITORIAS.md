# MERGE REPORT — Auditorías PADDYFLOW + Técnica

**Fecha:** Marzo 2025  
**Fuentes:** `AUDITORIA_PADDYFLOW.md` (producto/funcional), `AUDITORIA_TECNICA.md` (seguridad/integridad/performance)

---

## 1. TABLA CONSOLIDADA DE HALLAZGOS

| # | Área | Hallazgo | Origen | Impacto | Fix propuesto | Archivos/Rutas | Riesgo cambio |
|---|------|----------|--------|---------|---------------|----------------|---------------|
| 1 | Security | JWT fallback `dev-secret-change-me` | TECNICA | Alto | Fail-fast si falta JWT_SECRET | `server/src/middleware/auth.ts` | Bajo |
| 2 | Security | CORS `origin: true` permite cualquier origen | TECNICA | Alto | Restringir a APP_BASE_URL + localhost | `server/src/index.ts` | Bajo |
| 3 | Security | No rate limiting | TECNICA, PADDYFLOW | Alto | express-rate-limit en /api/auth | `server/src/index.ts` | Bajo |
| 4 | Security | Webhook Stripe: webhookSecret puede ser undefined | TECNICA | Medio | Verificar al boot, 500 si falta | `server/src/routes/stripeWebhook.ts` | Bajo |
| 5 | Security | req.user incluye passwordHash | TECNICA | Alto | select sin passwordHash, tipo UserSafe | `auth.ts`, `express.d.ts` | Medio |
| 6 | Security | Token en localStorage (XSS) | TECNICA | Medio | sessionStorage + doc o cookie httpOnly | `client/src/context/AuthContext.tsx` | Medio |
| 7 | Integrity | Register sin transacción (tenant huérfano) | TECNICA | Alto | db.transaction() en auth/register | `server/src/routes/auth.ts` | Bajo |
| 8 | Integrity | No unique(tenantId, email) en users | TECNICA | Alto | unique constraint + migración | `schema.ts`, migración | Medio |
| 9 | Integrity | Numeración proformas: load all + race | TECNICA | Alto | Tabla contadores o transacción FOR UPDATE | `server/src/routes/sales.ts` | Medio |
| 10 | Integrity | Numeración facturas: sin transacción | TECNICA | Alto | Transacción con FOR UPDATE en secuencia | `server/src/routes/sales.ts` | Medio |
| 11 | Integrity | Validación transiciones estado docs | TECNICA | Bajo | Si se añade PATCH, validar DRAFT→ISSUED→CANCELED | `sales.ts` | Bajo |
| 12 | Performance | Proformas: load all para numeración | TECNICA | Alto | Resuelto con #9 | - | - |
| 13 | Performance | Reports: filtros from/to en memoria | TECNICA | Alto | and(gte, lte) en SQL | `server/src/routes/reports.ts` | Bajo |
| 14 | Performance | Índices sales_documents | TECNICA | Medio | tenantId+createdAt, tenantId+issueDate | `schema.ts`, migración | Bajo |
| 15 | Product | Pesadas (weigh_tickets) no existe | PADDYFLOW | Alto | DB + API + UI + print + Excel | Nuevo módulo | Medio |
| 16 | Product | Catálogo terceros: suppliers, processors | PADDYFLOW | Alto | CRUD suppliers, processors | Nuevo módulo | Medio |
| 17 | Product | Customers sin CRUD completo | PADDYFLOW | Alto | Reutilizar tabla, añadir CRUD + isActive + search | `customers` existente | Bajo |
| 18 | Product | Choferes y camiones no existen | PADDYFLOW | Alto | drivers, trucks CRUD | Nuevo módulo | Medio |
| 19 | Product | Lotes + envíos + recepción granel | PADDYFLOW | Alto | lots, shipments, bulk_receipts | Nuevo módulo | Alto |
| 20 | Product | Inventario (items, movimientos, kardex) | PADDYFLOW | Alto | items, inventory_moves, existencias | Nuevo módulo | Alto |
| 21 | Product | Rendimiento/liquidación por lote | PADDYFLOW | Alto | inputKg, outputKg, yield%, reporte | Nuevo módulo | Medio |
| 22 | Product | Impresión ticket pesada | PADDYFLOW | Alto | /print/weigh-ticket/:id | Nuevo endpoint + UI | Bajo |
| 23 | Product | Onboarding guiado en dashboard | PADDYFLOW | Medio | Checklist en Dashboard | `Dashboard.tsx` | Bajo |
| 24 | Product | Docs + terms + privacy + soporte | PADDYFLOW | Medio | /docs, placeholders legales | Nuevos archivos | Bajo |
| 25 | Product | e-CF real | PADDYFLOW | Bajo | Mantener stub, documentar limitación | /docs | Bajo |

---

## 2. DUPLICADOS Y CONFLICTOS

| Duplicado | Hallazgos | Resolución |
|-----------|-----------|------------|
| Rate limiting | TECNICA (seguridad) + PADDYFLOW (calidad) | Un solo fix: rate limit en auth |
| Numeración proformas | TECNICA (integridad + performance) | Un fix: contador transaccional resuelve ambos |
| Customers | PADDYFLOW (catálogo terceros) | Reutilizar tabla existente, NO crear customers2 |

**Conflictos:** Ninguno. Las auditorías son complementarias.

---

## 3. ORDEN DE EJECUCIÓN Y CRITERIOS "DONE"

### Fase A — Hardening (PRIMERO)

| Orden | Commit | Hallazgos | Done cuando |
|-------|--------|-----------|-------------|
| A1 | security: jwt hardening + env fail-fast | #1 | JWT_SECRET obligatorio, no fallback |
| A2 | security: cors restricted | #2 | CORS solo APP_BASE_URL + localhost |
| A3 | security: rate limiting | #3 | Rate limit en login/register |
| A4 | security: stripe webhook check | #4 | webhookSecret validado al inicio |
| A5 | security: sanitize req.user | #5 | passwordHash nunca en req.user |
| A6 | frontend: token storage | #6 | sessionStorage o doc limitación |
| A7 | integrity: register transaction | #7 | tenant+user en transacción |
| A8 | integrity: unique email + migration | #8 | unique(tenantId, email) |
| A9 | integrity: safe document numbering | #9, #10 | Proformas y facturas con transacción |
| A10 | perf: sql filters + indices | #13, #14 | Reports con filtros SQL, índices |

### Fase B — Producto Operativo (DESPUÉS)

| Orden | Commit | Hallazgos | Done cuando |
|-------|--------|-----------|-------------|
| B1 | p0: weigh_tickets | #15, #22 | CRUD + filtros + print + Excel |
| B2 | p0: suppliers/processors + customers | #16, #17 | CRUD terceros, customers completo |
| B3 | p0: drivers/trucks | #18 | CRUD choferes y camiones |
| B4 | p1: lots/shipments/bulk_receipts | #19 | Lotes + envíos + recepción granel |
| B5 | p1: inventory | #20 | items, movimientos, kardex |
| B6 | p1: yield report | #21 | Rendimiento por lote + Excel |
| B7 | onboarding + docs + legal | #23, #24, #25 | Dashboard checklist, docs, limitación e-CF |

---

## 4. PLAN DE COMMITS (ORDEN OBLIGATORIO)

### A. Hardening
1. `security: jwt hardening + remove fallback + env fail-fast`
2. `security: cors restricted + config`
3. `security: rate limiting`
4. `security: stripe webhook signature + raw body + idempotency` (verificar, ya OK)
5. `security: sanitize req.user + remove passwordHash leaks`
6. `frontend: token storage improvement + api client updates`
7. `integrity: register transaction + unique constraints`
8. `integrity: safe document numbering (transactional counter)`
9. `perf: sql filters + indices`

### B. Operativo
10. `p0: weigh_tickets db+api+ui+print+excel`
11. `p0: suppliers/processors + customers reuse/completion`
12. `p0: drivers/trucks + relationships`
13. `p1: lots/shipments/bulk_receipts + ui detail`
14. `p1: inventory items/moves + receipt split + ui`
15. `p1: yield report + excel`
16. `onboarding dashboard checklist + docs + legal placeholders + support`

---

## 5. QA CHECKLIST FINAL (OBLIGATORIO)

### Seguridad
- [ ] CORS bloquea origins no permitidos
- [ ] Rate limit en login/register
- [ ] Webhook rechaza firma inválida
- [ ] passwordHash no aparece nunca en responses
- [ ] Token no en localStorage (o limitación documentada)

### Integridad
- [ ] Register transaccional
- [ ] Emails unique (tenantId, email)
- [ ] Numeración no duplica con requests paralelos

### Operativo
- [ ] Terceros (supplier/processor/customer) CRUD
- [ ] Pesada crea/filtra/imprime/exporta Excel
- [ ] Lote: entradas → envío → recepción
- [ ] Inventario: existencias + kardex
- [ ] Rendimiento por lote + export Excel

### Multi-tenant
- [ ] Tenant A no ve datos tenant B

---

## 6. ENTREGA FINAL (AL COMPLETAR)

- Resumen de fixes por auditoría
- Limitaciones restantes (e-CF stub, etc.)
- Guía rápida "cómo operar" (docs)
- Próximos pasos (P2: compras/cxp, UI enterprise, contabilidad lite, DGII real)
