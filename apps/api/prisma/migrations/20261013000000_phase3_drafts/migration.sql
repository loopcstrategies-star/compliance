CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "legal_name" TEXT NOT NULL,
    "customer_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "customer_type" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_schemas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    CONSTRAINT "form_schemas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schema_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "widget" TEXT NOT NULL,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "columns" JSONB,
    "sort_order" INTEGER NOT NULL,
    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "applicability_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_type" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "applicability_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "field_key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");
CREATE INDEX "invitations_tenant_id_idx" ON "invitations"("tenant_id");
CREATE UNIQUE INDEX "form_schemas_template_id_version_key" ON "form_schemas"("template_id", "version");
CREATE UNIQUE INDEX "form_fields_schema_id_field_key_key" ON "form_fields"("schema_id", "field_key");
CREATE UNIQUE INDEX "applicability_rules_customer_type_template_id_field_key_key" ON "applicability_rules"("customer_type", "template_id", "field_key");
CREATE INDEX "checklist_categories_tenant_id_idx" ON "checklist_categories"("tenant_id");
CREATE INDEX "applications_tenant_id_idx" ON "applications"("tenant_id");
CREATE UNIQUE INDEX "answers_application_id_field_key_key" ON "answers"("application_id", "field_key");
CREATE INDEX "answers_tenant_id_idx" ON "answers"("tenant_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "form_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_categories" ADD CONSTRAINT "checklist_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "checklist_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answers" FORCE ROW LEVEL SECURITY;

CREATE POLICY customers_isolation ON customers
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY invitations_isolation ON invitations
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR (
      current_setting('app.invitation_lookup', true) <> ''
      AND token_hash = current_setting('app.invitation_lookup', true)
    )
  )
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY checklist_categories_isolation ON checklist_categories
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY applications_isolation ON applications
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY answers_isolation ON answers
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  customers, invitations, form_schemas, form_fields, applicability_rules,
  checklist_categories, applications, answers
  TO myka_app;
