import type { Tenant } from '../db/schema.js';
import type { SafeUser } from './safeUser.js';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado, sin passwordHash (inyectado por authMiddleware) */
      user?: SafeUser & { tenant: Tenant };
      /** Tenant del usuario (inyectado por tenantMiddleware) */
      tenantId?: string;
    }
  }
}

export {};
