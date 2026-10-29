CREATE TABLE "company_network_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "introduction" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "business_categories" JSONB NOT NULL DEFAULT '[]',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "public_email" TEXT NOT NULL DEFAULT '',
    "public_phone" TEXT NOT NULL DEFAULT '',
    "products_services" TEXT NOT NULL DEFAULT '',
    "capabilities" TEXT NOT NULL DEFAULT '',
    "company_size" TEXT NOT NULL DEFAULT '',
    "year_established" INTEGER,
    "discoverable" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "messaging_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_network_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_network_profiles_tenant_id_key" ON "company_network_profiles"("tenant_id");
CREATE INDEX "company_network_profiles_discoverable_industry_country_city_idx" ON "company_network_profiles"("discoverable", "industry", "country", "city");

ALTER TABLE "company_network_profiles" ADD CONSTRAINT "company_network_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_tenant_id" UUID NOT NULL,
    "addressee_tenant_id" UUID NOT NULL,
    "tenant_low_id" UUID NOT NULL,
    "tenant_high_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "responded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    CONSTRAINT "company_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_connections_distinct_tenants" CHECK ("requester_tenant_id" <> "addressee_tenant_id"),
    CONSTRAINT "company_connections_low_high_order" CHECK ("tenant_low_id" < "tenant_high_id")
);

CREATE UNIQUE INDEX "company_connections_tenant_low_id_tenant_high_id_key" ON "company_connections"("tenant_low_id", "tenant_high_id");
CREATE INDEX "company_connections_requester_tenant_id_status_idx" ON "company_connections"("requester_tenant_id", "status");
CREATE INDEX "company_connections_addressee_tenant_id_status_idx" ON "company_connections"("addressee_tenant_id", "status");

ALTER TABLE "company_connections" ADD CONSTRAINT "company_connections_requester_tenant_id_fkey" FOREIGN KEY ("requester_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_connections" ADD CONSTRAINT "company_connections_addressee_tenant_id_fkey" FOREIGN KEY ("addressee_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "tenant_low_id" UUID NOT NULL,
    "tenant_high_id" UUID NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_conversations_connection_id_key" ON "company_conversations"("connection_id");
CREATE INDEX "company_conversations_tenant_low_id_idx" ON "company_conversations"("tenant_low_id");
CREATE INDEX "company_conversations_tenant_high_id_idx" ON "company_conversations"("tenant_high_id");

ALTER TABLE "company_conversations" ADD CONSTRAINT "company_conversations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "company_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_tenant_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    CONSTRAINT "company_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_messages_conversation_id_created_at_idx" ON "company_messages"("conversation_id", "created_at");
CREATE INDEX "company_messages_sender_tenant_id_read_at_idx" ON "company_messages"("sender_tenant_id", "read_at");

ALTER TABLE "company_messages" ADD CONSTRAINT "company_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "company_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_network_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_network_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_network_profiles_isolation ON company_network_profiles
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR (
      discoverable = true
      AND visibility = 'public'
    )
    OR (
      visibility = 'connections'
      AND EXISTS (
        SELECT 1 FROM company_connections c
        WHERE c.status = 'accepted'
          AND (
            (c.requester_tenant_id = company_network_profiles.tenant_id AND c.addressee_tenant_id::text = current_setting('app.tenant_id', true))
            OR (c.addressee_tenant_id = company_network_profiles.tenant_id AND c.requester_tenant_id::text = current_setting('app.tenant_id', true))
          )
      )
    )
  )
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE "company_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_connections_isolation ON company_connections
  USING (
    requester_tenant_id::text = current_setting('app.tenant_id', true)
    OR addressee_tenant_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    requester_tenant_id::text = current_setting('app.tenant_id', true)
    OR addressee_tenant_id::text = current_setting('app.tenant_id', true)
  );

ALTER TABLE "company_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_conversations" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_conversations_isolation ON company_conversations
  USING (
    tenant_low_id::text = current_setting('app.tenant_id', true)
    OR tenant_high_id::text = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    tenant_low_id::text = current_setting('app.tenant_id', true)
    OR tenant_high_id::text = current_setting('app.tenant_id', true)
  );

ALTER TABLE "company_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_messages_isolation ON company_messages
  USING (
    EXISTS (
      SELECT 1 FROM company_conversations cv
      WHERE cv.id = company_messages.conversation_id
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  )
  WITH CHECK (
    sender_tenant_id::text = current_setting('app.tenant_id', true)
    AND EXISTS (
      SELECT 1 FROM company_conversations cv
      WHERE cv.id = company_messages.conversation_id
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON company_network_profiles TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_connections TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_conversations TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_messages TO myka_app;
