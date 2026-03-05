import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import tenantRoutes from './routes/tenants.js';
import billingRoutes from './routes/billing.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import dgiiSequencesRoutes from './routes/dgiiSequences.js';
import salesRoutes from './routes/sales.js';
import reportsRoutes from './routes/reports.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: true, credentials: true }));

// Webhook Stripe: raw body obligatorio para validar firma (ANTES de express.json)
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

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas protegidas (multi-tenant)
app.use('/api/tenants', tenantRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dgii/sequences', dgiiSequencesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);

app.listen(PORT, () => {
  console.log(`PaddyFlow API running on http://localhost:${PORT}`);
});
