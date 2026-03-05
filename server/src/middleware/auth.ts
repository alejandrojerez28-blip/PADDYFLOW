import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users, tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as string | number;

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

/**
 * Genera un JWT para el usuario
 */
export function signToken(payload: Omit<JwtPayload, 'role'> & { role?: string }): string {
  const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(
    {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role ?? 'Viewer',
    } satisfies JwtPayload,
    JWT_SECRET,
    signOptions
  );
}

/**
 * Middleware de autenticación.
 * Verifica el JWT en Authorization: Bearer <token> y carga el usuario + tenant.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No autorizado: token requerido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const [userRow] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, decoded.userId),
          eq(users.tenantId, decoded.tenantId),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (!userRow) {
      res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
      return;
    }

    const [tenantRow] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, userRow.tenantId))
      .limit(1);

    if (!tenantRow) {
      res.status(401).json({ error: 'Tenant no encontrado' });
      return;
    }

    req.user = {
      ...userRow,
      tenant: tenantRow,
    };
    req.tenantId = userRow.tenantId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
