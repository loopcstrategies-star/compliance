DROP POLICY IF EXISTS company_messages_isolation ON company_messages;

CREATE POLICY company_messages_select ON company_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_conversations cv
      WHERE cv.id = company_messages.conversation_id
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
      SELECT 1 FROM company_conversations cv
      WHERE cv.id = company_messages.conversation_id
        AND (
          cv.tenant_low_id::text = current_setting('app.tenant_id', true)
          OR cv.tenant_high_id::text = current_setting('app.tenant_id', true)
        )
    )
  );

CREATE POLICY company_messages_update ON company_messages
  FOR UPDATE
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
    EXISTS (
      SELECT 1 FROM company_conversations cv
      WHERE cv.id = company_messages.conversation_id
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
