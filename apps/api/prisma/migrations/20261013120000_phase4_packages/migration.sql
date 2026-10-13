CREATE TABLE "template_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "page_count" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "letterhead_owner" TEXT NOT NULL,
    "source_file" TEXT NOT NULL,
    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "placements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_version_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rect" JSONB,
    CONSTRAINT "placements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stored_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "scan_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signature_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "authorised_at" TIMESTAMP(3) NOT NULL,
    "consent_text" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signature_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "letterheads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "letterheads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "generated_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_sha256" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "file_id" UUID NOT NULL,
    "painted" JSONB NOT NULL,
    "blocked" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_versions_template_id_version_key" ON "template_versions"("template_id", "version");
CREATE UNIQUE INDEX "placements_template_version_id_field_key_key" ON "placements"("template_version_id", "field_key");
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");
CREATE INDEX "stored_files_tenant_id_idx" ON "stored_files"("tenant_id");
CREATE UNIQUE INDEX "documents_application_id_field_key_key" ON "documents"("application_id", "field_key");
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");
CREATE INDEX "signature_evidence_tenant_id_idx" ON "signature_evidence"("tenant_id");
CREATE UNIQUE INDEX "letterheads_tenant_id_key" ON "letterheads"("tenant_id");
CREATE UNIQUE INDEX "letterheads_file_id_key" ON "letterheads"("file_id");
CREATE UNIQUE INDEX "generated_packages_application_id_template_id_version_key" ON "generated_packages"("application_id", "template_id", "version");
CREATE INDEX "generated_packages_tenant_id_idx" ON "generated_packages"("tenant_id");

ALTER TABLE "placements" ADD CONSTRAINT "placements_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_evidence" ADD CONSTRAINT "signature_evidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_evidence" ADD CONSTRAINT "signature_evidence_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signature_evidence" ADD CONSTRAINT "signature_evidence_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "letterheads" ADD CONSTRAINT "letterheads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "letterheads" ADD CONSTRAINT "letterheads_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_packages" ADD CONSTRAINT "generated_packages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_packages" ADD CONSTRAINT "generated_packages_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "generated_packages" ADD CONSTRAINT "generated_packages_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stored_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stored_files" FORCE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "signature_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signature_evidence" FORCE ROW LEVEL SECURITY;
ALTER TABLE "letterheads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "letterheads" FORCE ROW LEVEL SECURITY;
ALTER TABLE "generated_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_packages" FORCE ROW LEVEL SECURITY;

CREATE POLICY stored_files_isolation ON stored_files
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY documents_isolation ON documents
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY signature_evidence_isolation ON signature_evidence
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY letterheads_isolation ON letterheads
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY generated_packages_isolation ON generated_packages
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  template_versions, placements, stored_files, documents, signature_evidence, letterheads, generated_packages
  TO myka_app;
