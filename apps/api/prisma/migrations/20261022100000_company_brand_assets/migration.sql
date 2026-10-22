CREATE TABLE "tenant_company_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "asset_type" TEXT NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_company_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_company_assets_tenant_id_asset_type_key" ON "tenant_company_assets"("tenant_id", "asset_type");
CREATE UNIQUE INDEX "tenant_company_assets_file_id_key" ON "tenant_company_assets"("file_id");
CREATE INDEX "tenant_company_assets_tenant_id_idx" ON "tenant_company_assets"("tenant_id");

ALTER TABLE "tenant_company_assets" ADD CONSTRAINT "tenant_company_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_company_assets" ADD CONSTRAINT "tenant_company_assets_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_company_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_company_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_company_assets_isolation ON tenant_company_assets
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_company_assets TO myka_app;
