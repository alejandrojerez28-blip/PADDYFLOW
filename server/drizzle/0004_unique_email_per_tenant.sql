-- Unique constraint: email único por tenant (case-insensitive)
-- Permite mismo email en distintos tenants; evita duplicados dentro del mismo tenant
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_tenant_lower_unique" ON "users" ("tenant_id", lower("email"));
