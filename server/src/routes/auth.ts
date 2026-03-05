import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { signToken } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  tenantName: z.string().min(1),
  country: z.string().length(2).optional(), // ISO2, ej: "DO"
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid(),
});

/**
 * POST /api/auth/register
 * Crea tenant + primer usuario (AdminTenant)
 */
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    return;
  }

  const { email, password, name, tenantName, country } = parsed.data;

  try {
    const [existingTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, tenantName))
      .limit(1);

    if (existingTenant) {
      res.status(409).json({ error: 'Ya existe un tenant con ese nombre' });
      return;
    }

    const isDO = country === 'DO';
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: tenantName,
        plan: 'basic',
        country: country ?? null,
        onboardingStatus: 'BASIC',
        taxMode: isDO ? 'DO_DGII' : 'GENERIC',
      })
      .returning();

    if (!newTenant) {
      res.status(500).json({ error: 'Error al crear tenant' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        tenantId: newTenant.id,
        email,
        name: name ?? email.split('@')[0],
        passwordHash,
        role: 'AdminTenant',
        isActive: true,
      })
      .returning();

    if (!newUser) {
      res.status(500).json({ error: 'Error al crear usuario' });
      return;
    }

    const token = signToken({
      userId: newUser.id,
      tenantId: newTenant.id,
      email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        tenantId: newTenant.id,
      },
      tenant: {
        id: newTenant.id,
        name: newTenant.name,
        plan: newTenant.plan,
        subscriptionStatus: newTenant.subscriptionStatus,
        country: newTenant.country,
        onboardingStatus: newTenant.onboardingStatus,
        taxMode: newTenant.taxMode,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/auth/login
 * Login con email + password + tenantId (identifica la organización)
 */
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    return;
  }

  const { email, password, tenantId } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.tenantId, tenantId),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      res.status(401).json({ error: 'Tenant no encontrado' });
      return;
    }

    const token = signToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        subscriptionStatus: tenant.subscriptionStatus,
        country: tenant.country,
        onboardingStatus: tenant.onboardingStatus,
        taxMode: tenant.taxMode,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
