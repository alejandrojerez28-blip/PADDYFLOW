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

// Tipo de pesada
export const weighTicketTypeEnum = pgEnum('weigh_ticket_type', ['PADDY', 'SUBPRODUCT', 'OTHER']);

// Estado de lote
export const lotStatusEnum = pgEnum('lot_status', ['OPEN', 'SENT', 'RECEIVED', 'CLOSED']);

// Estado de envío
export const shipmentStatusEnum = pgEnum('shipment_status', ['CREATED', 'IN_TRANSIT', 'DELIVERED']);

// Categoría de item (inventario)
export const itemCategoryEnum = pgEnum('item_category', ['FINISHED', 'SUBPRODUCT', 'OTHER']);

// Dirección de movimiento inventario
export const inventoryDirectionEnum = pgEnum('inventory_direction', ['IN', 'OUT', 'ADJUST']);

// Tipo de referencia del movimiento
export const inventoryRefTypeEnum = pgEnum('inventory_ref_type', ['BULK_RECEIPT', 'SALE', 'PURCHASE', 'MANUAL']);

// Modo de redondeo para liquidaciones
export const roundingModeEnum = pgEnum('rounding_mode', ['NONE', 'ROUND_2', 'ROUND_0']);

// Estado de liquidación a suplidor
export const settlementStatusEnum = pgEnum('settlement_status', ['DRAFT', 'APPROVED', 'PAID', 'CANCELED']);

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
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('customers_tenant_id_idx').on(table.tenantId),
    index('customers_tenant_active_idx').on(table.tenantId, table.isActive),
  ]
);

// ============ SUPPLIERS (proveedores/suplidores) ============
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    rncOrId: varchar('rnc_or_id', { length: 64 }),
    phone: varchar('phone', { length: 64 }),
    address: varchar('address', { length: 512 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('suppliers_tenant_name_idx').on(table.tenantId, table.name),
    index('suppliers_tenant_active_idx').on(table.tenantId, table.isActive),
  ]
);

// ============ PROCESSORS (procesadores externos) ============
export const processors = pgTable(
  'processors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    contactName: varchar('contact_name', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    address: varchar('address', { length: 512 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('processors_tenant_name_idx').on(table.tenantId, table.name),
    index('processors_tenant_active_idx').on(table.tenantId, table.isActive),
  ]
);

// ============ DRIVERS (choferes) ============
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    idNumber: varchar('id_number', { length: 64 }),
    phone: varchar('phone', { length: 64 }),
    license: varchar('license', { length: 64 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('drivers_tenant_name_idx').on(table.tenantId, table.name),
    index('drivers_tenant_active_idx').on(table.tenantId, table.isActive),
  ]
);

// ============ TRUCKS (camiones) ============
export const trucks = pgTable(
  'trucks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    plate: varchar('plate', { length: 32 }).notNull(),
    capacityKg: varchar('capacity_kg', { length: 32 }),
    owner: varchar('owner', { length: 255 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('trucks_tenant_plate_idx').on(table.tenantId, table.plate),
    index('trucks_tenant_active_idx').on(table.tenantId, table.isActive),
    unique('trucks_tenant_plate_unique').on(table.tenantId, table.plate),
  ]
);

// ============ LOTS (lotes) ============
export const lots = pgTable(
  'lots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 32 }).notNull(),
    status: lotStatusEnum('status').default('OPEN').notNull(),
    notes: varchar('notes', { length: 1024 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('lots_tenant_code_unique').on(table.tenantId, table.code),
    index('lots_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('lots_tenant_status_idx').on(table.tenantId, table.status),
  ]
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
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type Processor = typeof processors.$inferSelect;
export type NewProcessor = typeof processors.$inferInsert;
export type Driver = typeof drivers.$inferSelect;
export type NewDriver = typeof drivers.$inferInsert;
export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;
export type DgiiSequence = typeof dgiiSequences.$inferSelect;
export type NewDgiiSequence = typeof dgiiSequences.$inferInsert;
export type SalesDocument = typeof salesDocuments.$inferSelect;
export type NewSalesDocument = typeof salesDocuments.$inferInsert;
export type SalesDocumentItem = typeof salesDocumentItems.$inferSelect;
export type NewSalesDocumentItem = typeof salesDocumentItems.$inferInsert;
export type EcfTransmission = typeof ecfTransmissions.$inferSelect;
export type NewEcfTransmission = typeof ecfTransmissions.$inferInsert;

// ============ WEIGH TICKETS (Pesadas) ============
export const weighTickets = pgTable(
  'weigh_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    ticketNumber: varchar('ticket_number', { length: 32 }),
    type: weighTicketTypeEnum('type').notNull(),
    datetime: timestamp('datetime', { withTimezone: true }).notNull(),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    truckId: uuid('truck_id').references(() => trucks.id, { onDelete: 'set null' }),
    grossKg: decimal('gross_kg', { precision: 14, scale: 4 }).notNull(),
    tareKg: decimal('tare_kg', { precision: 14, scale: 4 }).notNull(),
    netKg: decimal('net_kg', { precision: 14, scale: 4 }).notNull(),
    notes: varchar('notes', { length: 1024 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('weigh_tickets_tenant_datetime_idx').on(table.tenantId, table.datetime),
    index('weigh_tickets_tenant_type_idx').on(table.tenantId, table.type),
    index('weigh_tickets_tenant_supplier_idx').on(table.tenantId, table.supplierId),
    index('weigh_tickets_tenant_driver_idx').on(table.tenantId, table.driverId),
    index('weigh_tickets_tenant_truck_idx').on(table.tenantId, table.truckId),
  ]
);

export type WeighTicket = typeof weighTickets.$inferSelect;
export type NewWeighTicket = typeof weighTickets.$inferInsert;

// ============ LOT INPUTS (pesadas asociadas al lote) ============
export const lotInputs = pgTable(
  'lot_inputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => lots.id, { onDelete: 'cascade' }),
    weighTicketId: uuid('weigh_ticket_id')
      .notNull()
      .references(() => weighTickets.id, { onDelete: 'cascade' }),
    netKg: decimal('net_kg', { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('lot_inputs_tenant_lot_ticket_unique').on(table.tenantId, table.lotId, table.weighTicketId),
    index('lot_inputs_tenant_lot_idx').on(table.tenantId, table.lotId),
  ]
);

// ============ SHIPMENTS (envíos a procesador) ============
export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => lots.id, { onDelete: 'cascade' }),
    processorId: uuid('processor_id')
      .notNull()
      .references(() => processors.id, { onDelete: 'cascade' }),
    shipDate: timestamp('ship_date', { withTimezone: true }),
    driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    truckId: uuid('truck_id').references(() => trucks.id, { onDelete: 'set null' }),
    shippedKg: decimal('shipped_kg', { precision: 14, scale: 4 }),
    status: shipmentStatusEnum('status').default('CREATED').notNull(),
    notes: varchar('notes', { length: 1024 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('shipments_tenant_lot_idx').on(table.tenantId, table.lotId),
    index('shipments_tenant_processor_idx').on(table.tenantId, table.processorId),
    index('shipments_tenant_shipdate_idx').on(table.tenantId, table.shipDate),
  ]
);

// ============ BULK RECEIPTS (recepción granel - super sacos) ============
export const bulkReceipts = pgTable(
  'bulk_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => lots.id, { onDelete: 'cascade' }),
    receiptDate: timestamp('receipt_date', { withTimezone: true }).notNull(),
    superSacksCount: integer('super_sacks_count').default(0).notNull(),
    totalKg: decimal('total_kg', { precision: 14, scale: 4 }).notNull(),
    notes: varchar('notes', { length: 1024 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('bulk_receipts_tenant_lot_idx').on(table.tenantId, table.lotId),
    index('bulk_receipts_tenant_receiptdate_idx').on(table.tenantId, table.receiptDate),
  ]
);

// ============ ITEMS (productos / subproductos) ============
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    sku: varchar('sku', { length: 64 }),
    category: itemCategoryEnum('category').notNull(),
    uom: varchar('uom', { length: 16 }).default('kg').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('items_tenant_name_unique').on(table.tenantId, table.name),
    index('items_tenant_category_idx').on(table.tenantId, table.category),
    index('items_tenant_active_idx').on(table.tenantId, table.isActive),
  ]
);

// ============ INVENTORY MOVES (kardex) ============
export const inventoryMoves = pgTable(
  'inventory_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    datetime: timestamp('datetime', { withTimezone: true })
      .defaultNow()
      .notNull(),
    direction: inventoryDirectionEnum('direction').notNull(),
    qtyKg: decimal('qty_kg', { precision: 14, scale: 4 }).notNull(),
    refType: inventoryRefTypeEnum('ref_type').notNull(),
    refId: uuid('ref_id'),
    notes: varchar('notes', { length: 1024 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('inventory_moves_tenant_item_datetime_idx').on(table.tenantId, table.itemId, table.datetime),
    index('inventory_moves_tenant_reftype_datetime_idx').on(table.tenantId, table.refType, table.datetime),
  ]
);

// ============ BULK RECEIPT SPLITS (distribución por item) ============
export const bulkReceiptSplits = pgTable(
  'bulk_receipt_splits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bulkReceiptId: uuid('bulk_receipt_id')
      .notNull()
      .references(() => bulkReceipts.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    qtyKg: decimal('qty_kg', { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('bulk_receipt_splits_tenant_receipt_item_unique').on(table.tenantId, table.bulkReceiptId, table.itemId),
    index('bulk_receipt_splits_tenant_receipt_idx').on(table.tenantId, table.bulkReceiptId),
  ]
);

// ============ WEIGH TICKET QUALITY (análisis por pesada) ============
export const weighTicketQuality = pgTable(
  'weigh_ticket_quality',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    weighTicketId: uuid('weigh_ticket_id')
      .notNull()
      .references(() => weighTickets.id, { onDelete: 'cascade' }),
    sampleDate: timestamp('sample_date', { withTimezone: true }).defaultNow().notNull(),
    moisturePct: decimal('moisture_pct', { precision: 5, scale: 2 }),
    impurityPct: decimal('impurity_pct', { precision: 5, scale: 2 }),
    brokenPct: decimal('broken_pct', { precision: 5, scale: 2 }),
    chalkyPct: decimal('chalky_pct', { precision: 5, scale: 2 }),
    remarks: varchar('remarks', { length: 1024 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('weigh_ticket_quality_weigh_ticket_unique').on(table.weighTicketId),
    index('weigh_ticket_quality_tenant_ticket_idx').on(table.tenantId, table.weighTicketId),
  ]
);

// ============ SUPPLIER PRICE RULES (reglas de pago por suplidor) ============
export const supplierPriceRules = pgTable(
  'supplier_price_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    effectiveFrom: date('effective_from').notNull(),
    basePricePerKg: decimal('base_price_per_kg', { precision: 12, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 8 }).default('DOP').notNull(),
    moistureBasePct: decimal('moisture_base_pct', { precision: 5, scale: 2 }).default('14.00').notNull(),
    moisturePenaltyPerPct: decimal('moisture_penalty_per_pct', { precision: 12, scale: 4 }).default('0').notNull(),
    impurityBasePct: decimal('impurity_base_pct', { precision: 5, scale: 2 }).default('1.00').notNull(),
    impurityPenaltyPerPct: decimal('impurity_penalty_per_pct', { precision: 12, scale: 4 }).default('0').notNull(),
    roundingMode: roundingModeEnum('rounding_mode').default('ROUND_2').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('supplier_price_rules_tenant_supplier_from_idx').on(table.tenantId, table.supplierId, table.effectiveFrom),
    index('supplier_price_rules_tenant_supplier_active_idx').on(table.tenantId, table.supplierId, table.isActive),
  ]
);

// ============ SUPPLIER SETTLEMENTS (liquidaciones) ============
export const supplierSettlements = pgTable(
  'supplier_settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    periodFrom: date('period_from').notNull(),
    periodTo: date('period_to').notNull(),
    status: settlementStatusEnum('status').default('DRAFT').notNull(),
    totalNetKg: decimal('total_net_kg', { precision: 14, scale: 4 }).default('0').notNull(),
    grossAmount: decimal('gross_amount', { precision: 14, scale: 4 }).default('0').notNull(),
    deductions: decimal('deductions', { precision: 14, scale: 4 }).default('0').notNull(),
    netPayable: decimal('net_payable', { precision: 14, scale: 4 }).default('0').notNull(),
    notes: varchar('notes', { length: 1024 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('supplier_settlements_tenant_supplier_idx').on(table.tenantId, table.supplierId),
    index('supplier_settlements_tenant_status_idx').on(table.tenantId, table.status),
    index('supplier_settlements_tenant_period_idx').on(table.tenantId, table.periodFrom, table.periodTo),
  ]
);

// ============ SUPPLIER SETTLEMENT LINES ============
export const supplierSettlementLines = pgTable(
  'supplier_settlement_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => supplierSettlements.id, { onDelete: 'cascade' }),
    weighTicketId: uuid('weigh_ticket_id')
      .notNull()
      .references(() => weighTickets.id, { onDelete: 'cascade' }),
    netKg: decimal('net_kg', { precision: 14, scale: 4 }).notNull(),
    pricePerKg: decimal('price_per_kg', { precision: 12, scale: 4 }).notNull(),
    moisturePct: decimal('moisture_pct', { precision: 5, scale: 2 }),
    impurityPct: decimal('impurity_pct', { precision: 5, scale: 2 }),
    penaltyAmount: decimal('penalty_amount', { precision: 14, scale: 4 }).default('0').notNull(),
    lineAmount: decimal('line_amount', { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('supplier_settlement_lines_weigh_ticket_unique').on(table.weighTicketId),
    index('supplier_settlement_lines_tenant_settlement_idx').on(table.tenantId, table.settlementId),
  ]
);

export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;
export type LotInput = typeof lotInputs.$inferSelect;
export type NewLotInput = typeof lotInputs.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
export type BulkReceipt = typeof bulkReceipts.$inferSelect;
export type NewBulkReceipt = typeof bulkReceipts.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type InventoryMove = typeof inventoryMoves.$inferSelect;
export type NewInventoryMove = typeof inventoryMoves.$inferInsert;
export type BulkReceiptSplit = typeof bulkReceiptSplits.$inferSelect;
export type NewBulkReceiptSplit = typeof bulkReceiptSplits.$inferInsert;
export type WeighTicketQuality = typeof weighTicketQuality.$inferSelect;
export type NewWeighTicketQuality = typeof weighTicketQuality.$inferInsert;
export type SupplierPriceRule = typeof supplierPriceRules.$inferSelect;
export type NewSupplierPriceRule = typeof supplierPriceRules.$inferInsert;
export type SupplierSettlement = typeof supplierSettlements.$inferSelect;
export type NewSupplierSettlement = typeof supplierSettlements.$inferInsert;
export type SupplierSettlementLine = typeof supplierSettlementLines.$inferSelect;
export type NewSupplierSettlementLine = typeof supplierSettlementLines.$inferInsert;
