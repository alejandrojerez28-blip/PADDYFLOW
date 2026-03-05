import type { User, Tenant } from '../db/schema.js';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado (inyectado por authMiddleware) */
      user?: User & { tenant: Tenant };
      /** Tenant del usuario (inyectado por tenantMiddleware) */
      tenantId?: string;
    }
  }
}

export {};
