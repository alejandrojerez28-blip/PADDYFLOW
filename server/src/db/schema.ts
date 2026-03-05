import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  pgEnum,
  index,
  jsonb,
  unique,
  integer,
  decimal,
  date,
} from 'drizzle-orm/pg-core';

// Roles del sistema
export const userRoleEnum = pgEnum('user_role', [
  'AdminTenant',
  'OperadorPesada',
  'Contabilidad',
  'Viewer',
]);

// Estados de suscripción Stripe
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
]);

// Planes billing (PLAN_BASIC, PLAN_PRO)
export const planEnum = pgEnum('plan', ['basic', 'pro', 'starter', 'enterprise']);

// Onboarding fiscal RD
export const onboardingStatusEnum = pgEnum('onboarding_status', [
  'BASIC',
  'FISCAL_PENDING',
  'FISCAL_READY',
]);

// Modo tributario
export const taxModeEnum = pgEnum('tax_mode', ['GENERIC', 'DO_DGII']);

// Proveedor e-CF
export const ecfProviderEnum = pgEnum('ecf_provider', ['NONE', 'PROVIDER_X', 'PROVIDER_Y']);

// Tipos de documento DGII (NCF/e-CF)
export const docTypeEnum = pgEnum('doc_type', [
  'NCF_B01',
  'NCF_B02',
  'NCF_B14',
  'NCF_B15',
  'ECF_E31',
  'ECF_E32',
  'ECF_E33',
  'ECF_E34',
  'ECF_E41',
  'ECF_E43',
  'ECF_E44',
  'ECF_E45',
]);

// Tipo de documento de venta
export const documentKindEnum = pgEnum('document_kind', [
  'FISCAL_INVOICE',
  'PROFORMA',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
]);

// Estado de documento
export const documentStatusEnum = pgEnum('document_status', ['DRAFT', 'ISSUED', 'CANCELED']);

// Estado transmisión e-CF
export const ecfProviderStatusEnum = pgEnum('ecf_provider_status', [
  'PENDING_SEND',
  'PENDING',
  'SENT',
  'ACCEPTED',
  'REJECTED',
]);

// ============ TENANTS ============
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  plan: planEnum('plan').default('basic').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  subscriptionStatus: subscriptionStatusEnum('subscription_status'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  subscriptionUpdatedAt: timestamp('subscription_updated_at', { withTimezone: true }),
  hadSubscriptionBefore: boolean('had_subscription_before').default(false).notNull(),
  // RD Tax / Fiscal
  country: varchar('country', { length: 2 }),
  onboardingStatus: onboardingStatusEnum('onboarding_status').default('BASIC').notNull(),
  taxMode: taxModeEnum('tax_mode').default('GENERIC').notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  tradeName: varchar('trade_name', { length: 255 }),
  rnc: varchar('rnc', { length: 32 }),
  fiscalAddress: varchar('fiscal_address', { length: 512 }),
  fiscalEmail: varchar('fiscal_email', { length: 255 }),
  fiscalPhone: varchar('fiscal_phone', { length: 64 }),
  itbisRegistered: boolean('itbis_registered').default(true).notNull(),
  defaultDocCurrency: varchar('default_doc_currency', { length: 3 }).default('USD'),
  // e-CF
  ecfProvider: ecfProviderEnum('ecf_provider').default('NONE').notNull(),
  ecfProviderConfig: jsonb('ecf_provider_config'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============ BILLING EVENTS (idempotencia + auditoría) ============
export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    stripeEventId: varchar('stripe_event_id', { length: 255 }).notNull(),
    type: varchar('type', { length: 128 }).notNull(),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('billing_events_stripe_event_id_unique').on(table.stripeEventId),
    index('billing_events_tenant_id_idx').on(table.tenantId),
  ]
);

export type BillingEvent = typeof billingEvents.$inferSelect;
export type NewBillingEvent = typeof billingEvents.$inferInsert;

// ============ DOCUMENT COUNTERS (numeración transaccional sin race) ============
export const documentCounters = pgTable(
  'document_counters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 64 }).notNull(),
    prefix: varchar('prefix', { length: 16 }).notNull(),
    nextNumber: integer('next_number').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('document_counters_tenant_key_unique').on(table.tenantId, table.key),
    index('document_counters_tenant_key_idx').on(table.tenantId, table.key),
  ]
);

export type DocumentCounter = typeof documentCounters.$inferSelect;
export type NewDocumentCounter = typeof documentCounters.$inferInsert;

// ============ USERS ============
// Unique: (tenant_id, lower(email)) — migración 0004_unique_email_per_tenant
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('Viewer').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('users_tenant_id_idx').on(table.tenantId),
    index('users_email_tenant_idx').on(table.email, table.tenantId),
  ]
);

// ============ CUSTOMERS (clientes para ventas) ============
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    rnc: varchar('rnc', { length: 32 }),
    address: varchar('address', { length: 512 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('customers_tenant_id_idx').on(table.tenantId)]
);

// ============ DGII SEQUENCES (NCF/e-CF) ============
export const dgiiSequences = pgTable(
  'dgii_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    docType: docTypeEnum('doc_type').notNull(),
    series: varchar('series', { length: 32 }),
    prefix: varchar('prefix', { length: 16 }).notNull(),
    startNumber: integer('start_number').notNull(),
    endNumber: integer('end_number').notNull(),
    currentNumber: integer('current_number').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    expiresAt: date('expires_at'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('dgii_sequences_tenant_id_idx').on(table.tenantId),
    index('dgii_sequences_tenant_doctype_idx').on(table.tenantId, table.docType),
  ]
);

// ============ SALES DOCUMENTS ============
export const salesDocuments = pgTable(
  'sales_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    currency: varchar('currency', { length: 3 }).default('DOP').notNull(),
    subtotal: decimal('subtotal', { precision: 14, scale: 2 }).default('0').notNull(),
    itbis: decimal('itbis', { precision: 14, scale: 2 }).default('0').notNull(),
    total: decimal('total', { precision: 14, scale: 2 }).default('0').notNull(),
    status: documentStatusEnum('status').default('DRAFT').notNull(),
    issueDate: date('issue_date'),
    notes: varchar('notes', { length: 1024 }),
    // Fiscal (NCF/e-CF)
    fiscalType: docTypeEnum('fiscal_type'),
    ncfOrEcfNumber: varchar('ncf_or_ecf_number', { length: 64 }),
    sequenceId: uuid('sequence_id').references(() => dgiiSequences.id, { onDelete: 'set null' }),
    // Proforma: numeración interna PF-000001
    internalNumber: varchar('internal_number', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('sales_documents_tenant_id_idx').on(table.tenantId),
    index('sales_documents_tenant_kind_idx').on(table.tenantId, table.kind),
    index('sales_documents_tenant_created_at_idx').on(table.tenantId, table.createdAt),
    index('sales_documents_tenant_issue_date_idx').on(table.tenantId, table.issueDate),
  ]
);

// ============ SALES DOCUMENT ITEMS ============
export const salesDocumentItems = pgTable(
  'sales_document_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => salesDocuments.id, { onDelete: 'cascade' }),
    itemName: varchar('item_name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 64 }),
    qty: decimal('qty', { precision: 14, scale: 4 }).notNull(),
    unitPrice: decimal('unit_price', { precision: 14, scale: 4 }).notNull(),
    itbisRate: decimal('itbis_rate', { precision: 5, scale: 2 }).default('0').notNull(),
    lineTotal: decimal('line_total', { precision: 14, scale: 2 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('sales_document_items_document_id_idx').on(table.documentId)]
);

// ============ ECF TRANSMISSIONS (proveedor autorizado) ============
export const ecfTransmissions = pgTable(
  'ecf_transmissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => salesDocuments.id, { onDelete: 'cascade' }),
    providerStatus: ecfProviderStatusEnum('provider_status').default('PENDING_SEND').notNull(),
    providerTrackingId: varchar('provider_tracking_id', { length: 255 }),
    xmlStorageKey: varchar('xml_storage_key', { length: 512 }),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ecf_transmissions_tenant_id_idx').on(table.tenantId),
    index('ecf_transmissions_document_id_idx').on(table.documentId),
  ]
);

// Tipos exportados para uso en la app
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type DgiiSequence = typeof dgiiSequences.$inferSelect;
export type NewDgiiSequence = typeof dgiiSequences.$inferInsert;
export type SalesDocument = typeof salesDocuments.$inferSelect;
export type NewSalesDocument = typeof salesDocuments.$inferInsert;
export type SalesDocumentItem = typeof salesDocumentItems.$inferSelect;
export type NewSalesDocumentItem = typeof salesDocumentItems.$inferInsert;
export type EcfTransmission = typeof ecfTransmissions.$inferSelect;
export type NewEcfTransmission = typeof ecfTransmissions.$inferInsert;
