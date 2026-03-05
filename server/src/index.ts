import 'dotenv/config';
import './env.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenants.js';
import billingRoutes from './routes/billing.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import dgiiSequencesRoutes from './routes/dgiiSequences.js';
import salesRoutes from './routes/sales.js';
import reportsRoutes from './routes/reports.js';
import weighTicketsRoutes from './routes/weighTickets.js';
import suppliersRoutes from './routes/suppliers.js';
import processorsRoutes from './routes/processors.js';
import customersRoutes from './routes/customers.js';
import driversRoutes from './routes/drivers.js';
import trucksRoutes from './routes/trucks.js';
import lotsRoutes from './routes/lots.js';
import itemsRoutes from './routes/items.js';
import inventoryRoutes from './routes/inventory.js';
import bulkReceiptsRoutes from './routes/bulkReceipts.js';
import onboardingRoutes from './routes/onboarding.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// CORS: restringir a APP_BASE_URL (comma-separated) o localhost:5173 en dev
const allowedOriginsRaw = process.env.APP_BASE_URL?.split(',').map((s) => s.trim()).filter(Boolean);
const allowedOrigins =
  allowedOriginsRaw && allowedOriginsRaw.length > 0 ? allowedOriginsRaw : ['http://localhost:5173'];
if (process.env.NODE_ENV !== 'production' && !allowedOrigins.includes('http://localhost:5173')) {
  allowedOrigins.push('http://localhost:5173');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman, curl, server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false); // Rechazar origen no permitido
    },
    credentials: true,
  })
);

// Webhook Stripe: raw body obligatorio para validar firma (ANTES de express.json).
// Solo /api/stripe/* recibe raw body; el resto usa express.json().
app.use(
  '/api/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookRoutes
);

app.use(express.json());

// Health check (sin auth)
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'paddyflow-api' });
});

// Docs estáticos (markdown) — solo en dev o si existen
const docsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
if (fs.existsSync(docsPath)) {
  app.use('/docs', express.static(docsPath));
}

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas (multi-tenant)
app.use('/api/tenants', tenantRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dgii/sequences', dgiiSequencesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/weigh-tickets', weighTicketsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/processors', processorsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/trucks', trucksRoutes);
app.use('/api/lots', lotsRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bulk-receipts', bulkReceiptsRoutes);
app.use('/api/onboarding', onboardingRoutes);

// Servir cliente React si existe client/dist (producción / Replit)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const HOST = process.env.HOST ?? '0.0.0.0';
app.listen(Number(PORT), HOST, () => {
  console.log(`PaddyFlow API running on http://${HOST}:${PORT}`);
});
