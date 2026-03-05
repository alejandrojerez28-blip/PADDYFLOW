-- Índices compuestos para performance (filtros por tenant + fecha/tipo)
-- sales_documents: listados ordenados y reportes por fecha
CREATE INDEX IF NOT EXISTS "sales_documents_tenant_created_at_idx" ON "sales_documents" USING btree ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "sales_documents_tenant_issue_date_idx" ON "sales_documents" USING btree ("tenant_id", "issue_date");
