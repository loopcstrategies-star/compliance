ALTER TABLE "applications" ADD COLUMN "assignee_id" UUID;
ALTER TABLE "applications" ADD COLUMN "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "documents" ADD COLUMN "expires_on" DATE;

CREATE TABLE "operations_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "maker_hours" INTEGER NOT NULL DEFAULT 48,
    "checker_hours" INTEGER NOT NULL DEFAULT 48,
    "approver_hours" INTEGER NOT NULL DEFAULT 48,
    "draft_reminder_days" INTEGER NOT NULL DEFAULT 7,
    "expiry_lead_days" INTEGER NOT NULL DEFAULT 30,
    "escalation_email" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "operations_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operations_policies_tenant_id_key" ON "operations_policies"("tenant_id");
CREATE UNIQUE INDEX "deliveries_idempotency_key_key" ON "deliveries"("idempotency_key");
CREATE INDEX "deliveries_tenant_id_idx" ON "deliveries"("tenant_id");
CREATE INDEX "deliveries_application_id_idx" ON "deliveries"("application_id");

ALTER TABLE "applications" ADD CONSTRAINT "applications_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operations_policies" ADD CONSTRAINT "operations_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operations_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operations_policies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deliveries" FORCE ROW LEVEL SECURITY;

CREATE POLICY operations_policies_isolation ON operations_policies
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY deliveries_isolation ON deliveries
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON operations_policies, deliveries TO myka_app;
