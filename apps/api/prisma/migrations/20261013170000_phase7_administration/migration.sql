ALTER TABLE "stored_files" ADD COLUMN "quarantined_at" TIMESTAMP(3);

CREATE TABLE "tenant_applicability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_type" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    CONSTRAINT "tenant_applicability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "retention_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "approver_id" UUID,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_applicability_tenant_id_customer_type_template_id_key" ON "tenant_applicability"("tenant_id", "customer_type", "template_id");
CREATE INDEX "tenant_applicability_tenant_id_idx" ON "tenant_applicability"("tenant_id");
CREATE UNIQUE INDEX "retention_policies_tenant_id_category_key" ON "retention_policies"("tenant_id", "category");
CREATE INDEX "retention_policies_tenant_id_idx" ON "retention_policies"("tenant_id");
CREATE INDEX "legal_holds_tenant_id_idx" ON "legal_holds"("tenant_id");
CREATE INDEX "deletion_requests_tenant_id_idx" ON "deletion_requests"("tenant_id");

ALTER TABLE "tenant_applicability" ADD CONSTRAINT "tenant_applicability_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_applicability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_applicability" FORCE ROW LEVEL SECURITY;
ALTER TABLE "retention_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retention_policies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "legal_holds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_holds" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deletion_requests" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_applicability_isolation ON tenant_applicability
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY retention_policies_isolation ON retention_policies
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY legal_holds_isolation ON legal_holds
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY deletion_requests_isolation ON deletion_requests
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenant_applicability, retention_policies, legal_holds, deletion_requests
  TO myka_app;
