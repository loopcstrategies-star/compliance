-- Prevent duplicate submissions for the same application document version.
-- Safe under concurrent submit: only one row per (application_id, document_version).
-- Correction resubmits already increment applications.document_version before insert.

CREATE UNIQUE INDEX "submissions_application_id_document_version_key"
  ON "submissions"("application_id", "document_version");
