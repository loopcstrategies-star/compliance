
-- Restrict message updates to read receipts only.
-- Row-level security policies continue to control which rows may be updated.

REVOKE UPDATE ON TABLE company_messages FROM myka_app;
GRANT UPDATE (read_at) ON TABLE company_messages TO myka_app;
