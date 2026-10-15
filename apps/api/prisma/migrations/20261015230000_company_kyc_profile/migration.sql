CREATE TABLE "company_kyc_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_kyc_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_kyc_profiles_tenant_id_key" ON "company_kyc_profiles"("tenant_id");

ALTER TABLE "company_kyc_profiles" ADD CONSTRAINT "company_kyc_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_kyc_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    CONSTRAINT "company_kyc_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_kyc_answers_profile_id_field_key_key" ON "company_kyc_answers"("profile_id", "field_key");
CREATE INDEX "company_kyc_answers_tenant_id_idx" ON "company_kyc_answers"("tenant_id");

ALTER TABLE "company_kyc_answers" ADD CONSTRAINT "company_kyc_answers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "company_kyc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_id" UUID NOT NULL,
    "issued_on" DATE,
    "expires_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_evidence_tenant_id_idx" ON "company_evidence"("tenant_id");

ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "company_kyc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_evidence" ADD CONSTRAINT "company_evidence_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "profile_share_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_contact" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "access_hash" TEXT,
    "field_keys" JSONB NOT NULL,
    "evidence_ids" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "access_expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_share_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_share_grants_token_hash_key" ON "profile_share_grants"("token_hash");
CREATE UNIQUE INDEX "profile_share_grants_access_hash_key" ON "profile_share_grants"("access_hash");
CREATE INDEX "profile_share_grants_tenant_id_idx" ON "profile_share_grants"("tenant_id");

ALTER TABLE "profile_share_grants" ADD CONSTRAINT "profile_share_grants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "company_kyc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_kyc_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_kyc_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "company_kyc_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_kyc_answers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "company_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_evidence" FORCE ROW LEVEL SECURITY;
ALTER TABLE "profile_share_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_share_grants" FORCE ROW LEVEL SECURITY;

CREATE POLICY company_kyc_profiles_isolation ON company_kyc_profiles
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY company_kyc_answers_isolation ON company_kyc_answers
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY company_evidence_isolation ON company_evidence
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY profile_share_grants_isolation ON profile_share_grants
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR (
      current_setting('app.grant_lookup', true) <> ''
      AND (
        token_hash = current_setting('app.grant_lookup', true)
        OR access_hash = current_setting('app.grant_lookup', true)
      )
    )
  )
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  company_kyc_profiles, company_kyc_answers, company_evidence, profile_share_grants
  TO myka_app;
