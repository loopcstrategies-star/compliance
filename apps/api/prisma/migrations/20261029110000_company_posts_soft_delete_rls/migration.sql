-- Allow own-tenant soft-delete: Prisma UPDATE ... RETURNING re-checks USING on the new row.
-- Own-tenant rows remain visible under RLS even when deleted_at is set; feed queries filter deletedAt in app code.

DROP POLICY IF EXISTS company_posts_isolation ON company_posts;
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
