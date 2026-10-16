INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'invitation.create'
WHERE r."key" = 'super_admin'
ON CONFLICT DO NOTHING;
