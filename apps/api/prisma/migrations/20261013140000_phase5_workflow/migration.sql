ALTER TABLE "applications" ADD COLUMN "document_version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "segregation_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "maker_distinct_from_checker" BOOLEAN NOT NULL DEFAULT true,
    "checker_distinct_from_approver" BOOLEAN NOT NULL DEFAULT true,
    "maker_distinct_from_approver" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "segregation_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_version" INTEGER NOT NULL,
    "package_ids" JSONB NOT NULL,
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_ids" JSONB NOT NULL,
    "document_version" INTEGER NOT NULL,
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "segregation_policies_tenant_id_key" ON "segregation_policies"("tenant_id");
CREATE INDEX "submissions_tenant_id_idx" ON "submissions"("tenant_id");
CREATE INDEX "submissions_application_id_idx" ON "submissions"("application_id");
CREATE INDEX "review_decisions_tenant_id_idx" ON "review_decisions"("tenant_id");
CREATE INDEX "review_decisions_submission_id_idx" ON "review_decisions"("submission_id");

ALTER TABLE "segregation_policies" ADD CONSTRAINT "segregation_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "segregation_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segregation_policies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "review_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_decisions" FORCE ROW LEVEL SECURITY;

CREATE POLICY segregation_policies_isolation ON segregation_policies
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY submissions_isolation ON submissions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY review_decisions_isolation ON review_decisions
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  segregation_policies, submissions, review_decisions
  TO myka_app;
