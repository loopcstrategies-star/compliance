CREATE TABLE "application_section_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "section_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "schema_version" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_section_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_section_progress_application_id_section_key_key" ON "application_section_progress"("application_id", "section_key");
CREATE INDEX "application_section_progress_tenant_id_idx" ON "application_section_progress"("tenant_id");
CREATE INDEX "application_section_progress_application_id_idx" ON "application_section_progress"("application_id");

ALTER TABLE "application_section_progress" ADD CONSTRAINT "application_section_progress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_section_progress" ADD CONSTRAINT "application_section_progress_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "application_section_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_section_progress" FORCE ROW LEVEL SECURITY;
CREATE POLICY application_section_progress_isolation ON application_section_progress
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON application_section_progress TO myka_app;
