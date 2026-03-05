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
