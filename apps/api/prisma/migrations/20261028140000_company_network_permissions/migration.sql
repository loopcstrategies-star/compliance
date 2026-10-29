INSERT INTO "permissions" ("id", "key")
VALUES
  (gen_random_uuid(), 'company_network.read'),
  (gen_random_uuid(), 'company_network.write')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.key IN ('employee', 'maker', 'checker', 'authorised_approver', 'super_admin')
  AND p.key IN ('company_network.read', 'company_network.write')
ON CONFLICT DO NOTHING;
