# Desplegar PaddyFlow en Replit

## 1. Importar desde GitHub

1. Ve a [replit.com](https://replit.com) e inicia sesión
2. **Create Repl** → **Import from GitHub**
3. URL: `https://github.com/alejandrojerez28-blip/PADDYFLOW`
4. Click **Import**

## 2. Configurar Secrets (Variables de entorno)

En Replit: **Tools** → **Secrets** (o el ícono de candado)

Añade estas variables:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de PostgreSQL (Replit Postgres o Neon/Supabase) |
| `JWT_SECRET` | Clave secreta para JWT |
| `STRIPE_SECRET_KEY` | (opcional) Para billing |
| `STRIPE_WEBHOOK_SECRET` | (opcional) Para webhooks |
| `STRIPE_PRICE_BASIC` | (opcional) Price ID Basic |
| `STRIPE_PRICE_PRO` | (opcional) Price ID Pro |
| `APP_BASE_URL` | URL de tu Repl (ej: https://PADDYFLOW.alejandrojerez28-blip.repl.co) |
| `API_BASE_URL` | Misma URL que APP_BASE_URL |

## 3. Base de datos

**Opción A - Replit Postgres** (si tu plan lo incluye):
- Tools → Database → Create Database
- Copia la URL a `DATABASE_URL`

**Opción B - Neon.tech** (gratis):
1. Crea cuenta en [neon.tech](https://neon.tech)
2. Crea proyecto → copia connection string
3. Pega en `DATABASE_URL`

## 4. Ejecutar migraciones

En la consola de Replit:
```bash
cd server && npm run db:migrate
```

## 5. Run

Click **Run** o ejecuta `npm run dev`

- **Desarrollo**: frontend en puerto 5173, backend en 3001
- **Deploy**: usa `npm run start` (build + servidor único)

## 6. Deploy a producción

En Replit: **Deploy** → configura y publica. La app quedará en una URL tipo:
`https://PADDYFLOW.alejandrojerez28-blip.repl.co`
