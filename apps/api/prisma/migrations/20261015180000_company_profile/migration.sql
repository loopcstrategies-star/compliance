ALTER TABLE "tenants" ADD COLUMN "display_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "registration_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "registered_address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "operating_address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "country" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "website" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tenants" ADD COLUMN "compliance_email" TEXT NOT NULL DEFAULT '';
