-- Harden conversation/message RLS: require an accepted connection for SELECT,
-- and allow UPDATE only for non-sender participants (recipient mark-read).

DROP POLICY IF EXISTS company_conversations_isolation ON company_conversations;

CREATE POLICY company_conversations_isolation ON company_conversations
  USING (
    (
      tenant_low_id::text = current_setting('app.tenant_id', true)
      OR tenant_high_id::text = current_setting('app.tenant_id', true)
    )
    AND EXISTS (
      SELECT 1 FROM company_connections c
      WHERE c.id = company_conversations.connection_id
        AND c.status = 'accepted'
    )
  )
  WITH CHECK (
    (
      tenant_low_id::text = current_setting('app.tenant_id', true)
      OR tenant_high_id::text = current_setting('app.tenant_id', true)
    )
    AND EXISTS (
      SELECT 1 FROM company_connections c
      WHERE c.id = company_conversations.connection_id
        AND c.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS company_messages_select ON company_messages;
DROP POLICY IF EXISTS company_messages_insert ON company_messages;
DROP POLICY IF EXISTS company_messages_update ON company_messages;
DROP POLICY IF EXISTS company_messages_delete ON company_messages;

CREATE POLICY company_messages_select ON company_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM company_conversations cv
      JOIN company_connections c ON c.id = cv.connection_id
      WHERE cv.id = company_messages.conversation_id
        AND c.status = 'accepted'
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  );

CREATE POLICY company_messages_insert ON company_messages
  FOR INSERT
  WITH CHECK (
    sender_tenant_id::text = current_setting('app.tenant_id', true)
    AND EXISTS (
      SELECT 1
      FROM company_conversations cv
      JOIN company_connections c ON c.id = cv.connection_id
      WHERE cv.id = company_messages.conversation_id
        AND c.status = 'accepted'
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  );

CREATE POLICY company_messages_update ON company_messages
  FOR UPDATE
  USING (
    sender_tenant_id::text <> current_setting('app.tenant_id', true)
    AND EXISTS (
      SELECT 1
      FROM company_conversations cv
      JOIN company_connections c ON c.id = cv.connection_id
      WHERE cv.id = company_messages.conversation_id
        AND c.status = 'accepted'
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  )
  WITH CHECK (
    sender_tenant_id::text <> current_setting('app.tenant_id', true)
    AND EXISTS (
      SELECT 1
      FROM company_conversations cv
      JOIN company_connections c ON c.id = cv.connection_id
      WHERE cv.id = company_messages.conversation_id
        AND c.status = 'accepted'
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  );

CREATE POLICY company_messages_delete ON company_messages
  FOR DELETE
  USING (
    sender_tenant_id::text = current_setting('app.tenant_id', true)
  );
