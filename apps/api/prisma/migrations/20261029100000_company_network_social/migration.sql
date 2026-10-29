-- Member networking profiles, company activity feed, and in-app notifications (additive).

CREATE TABLE "member_network_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_title" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "introduction" TEXT NOT NULL DEFAULT '',
    "photo_file_id" UUID,
    "notify_messages" BOOLEAN NOT NULL DEFAULT true,
    "notify_connections" BOOLEAN NOT NULL DEFAULT true,
    "notify_feed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_network_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_network_profiles_user_id_tenant_id_key" ON "member_network_profiles"("user_id", "tenant_id");
CREATE INDEX "member_network_profiles_tenant_id_idx" ON "member_network_profiles"("tenant_id");

ALTER TABLE "member_network_profiles" ADD CONSTRAINT "member_network_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_network_profiles" ADD CONSTRAINT "member_network_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "member_network_profiles" ADD CONSTRAINT "member_network_profiles_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "company_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "post_type" TEXT NOT NULL DEFAULT 'announcement',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "company_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_posts_tenant_id_created_at_idx" ON "company_posts"("tenant_id", "created_at");
CREATE INDEX "company_posts_deleted_at_idx" ON "company_posts"("deleted_at");

ALTER TABLE "company_posts" ADD CONSTRAINT "company_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_posts" ADD CONSTRAINT "company_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_post_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "author_tenant_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_post_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_post_comments_post_id_created_at_idx" ON "company_post_comments"("post_id", "created_at");

ALTER TABLE "company_post_comments" ADD CONSTRAINT "company_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "company_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_post_comments" ADD CONSTRAINT "company_post_comments_author_tenant_id_fkey" FOREIGN KEY ("author_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_post_comments" ADD CONSTRAINT "company_post_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_post_reactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "actor_tenant_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reaction_type" TEXT NOT NULL DEFAULT 'like',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_post_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_post_reactions_post_actor_key" ON "company_post_reactions"("post_id", "actor_tenant_id", "actor_user_id");
CREATE INDEX "company_post_reactions_post_id_idx" ON "company_post_reactions"("post_id");

ALTER TABLE "company_post_reactions" ADD CONSTRAINT "company_post_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "company_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_post_reactions" ADD CONSTRAINT "company_post_reactions_actor_tenant_id_fkey" FOREIGN KEY ("actor_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_post_reactions" ADD CONSTRAINT "company_post_reactions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "company_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_tenant_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_notifications_recipient_user_id_read_at_idx" ON "company_notifications"("recipient_user_id", "read_at");
CREATE INDEX "company_notifications_recipient_tenant_id_created_at_idx" ON "company_notifications"("recipient_tenant_id", "created_at");

ALTER TABLE "company_notifications" ADD CONSTRAINT "company_notifications_recipient_tenant_id_fkey" FOREIGN KEY ("recipient_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_notifications" ADD CONSTRAINT "company_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "member_network_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_network_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY member_network_profiles_isolation ON member_network_profiles
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR EXISTS (
      SELECT 1 FROM company_network_profiles p
      WHERE p.tenant_id = member_network_profiles.tenant_id
        AND (
          (p.discoverable = true AND p.visibility = 'public')
          OR (
            p.visibility = 'connections'
            AND EXISTS (
              SELECT 1 FROM company_connections c
              WHERE c.status = 'accepted'
                AND (
                  (c.requester_tenant_id = p.tenant_id AND c.addressee_tenant_id::text = current_setting('app.tenant_id', true))
                  OR (c.addressee_tenant_id = p.tenant_id AND c.requester_tenant_id::text = current_setting('app.tenant_id', true))
                )
            )
          )
        )
    )
  )
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE "company_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_posts" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_posts_isolation ON company_posts
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM company_network_profiles p
        WHERE p.tenant_id = company_posts.tenant_id
          AND (
            (p.discoverable = true AND p.visibility = 'public')
            OR (
              p.visibility = 'connections'
              AND EXISTS (
                SELECT 1 FROM company_connections c
                WHERE c.status = 'accepted'
                  AND (
                    (c.requester_tenant_id = p.tenant_id AND c.addressee_tenant_id::text = current_setting('app.tenant_id', true))
                    OR (c.addressee_tenant_id = p.tenant_id AND c.requester_tenant_id::text = current_setting('app.tenant_id', true))
                  )
              )
            )
          )
      )
    )
  )
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE "company_post_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_post_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_post_comments_isolation ON company_post_comments
  USING (
    EXISTS (
      SELECT 1 FROM company_posts p
      WHERE p.id = company_post_comments.post_id
        AND p.deleted_at IS NULL
        AND (
          p.tenant_id::text = current_setting('app.tenant_id', true)
          OR EXISTS (
            SELECT 1 FROM company_network_profiles np
            WHERE np.tenant_id = p.tenant_id
              AND (
                (np.discoverable = true AND np.visibility = 'public')
                OR (
                  np.visibility = 'connections'
                  AND EXISTS (
                    SELECT 1 FROM company_connections c
                    WHERE c.status = 'accepted'
                      AND (
                        (c.requester_tenant_id = np.tenant_id AND c.addressee_tenant_id::text = current_setting('app.tenant_id', true))
                        OR (c.addressee_tenant_id = np.tenant_id AND c.requester_tenant_id::text = current_setting('app.tenant_id', true))
                      )
                  )
                )
              )
          )
        )
    )
  )
  WITH CHECK (author_tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE "company_post_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_post_reactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_post_reactions_isolation ON company_post_reactions
  USING (
    EXISTS (
      SELECT 1 FROM company_posts p
      WHERE p.id = company_post_reactions.post_id
        AND p.deleted_at IS NULL
        AND (
          p.tenant_id::text = current_setting('app.tenant_id', true)
          OR EXISTS (
            SELECT 1 FROM company_network_profiles np
            WHERE np.tenant_id = p.tenant_id
              AND (
                (np.discoverable = true AND np.visibility = 'public')
                OR (
                  np.visibility = 'connections'
                  AND EXISTS (
                    SELECT 1 FROM company_connections c
                    WHERE c.status = 'accepted'
                      AND (
                        (c.requester_tenant_id = np.tenant_id AND c.addressee_tenant_id::text = current_setting('app.tenant_id', true))
                        OR (c.addressee_tenant_id = np.tenant_id AND c.requester_tenant_id::text = current_setting('app.tenant_id', true))
                      )
                  )
                )
              )
          )
        )
    )
  )
  WITH CHECK (actor_tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE "company_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY company_notifications_isolation ON company_notifications
  USING (recipient_tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (recipient_tenant_id::text = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON member_network_profiles TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_posts TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_post_comments TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_post_reactions TO myka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_notifications TO myka_app;
