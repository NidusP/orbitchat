CREATE TABLE "knowledge_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_type" varchar(16) NOT NULL,
  "source_id" varchar(255) NOT NULL,
  "text" text NOT NULL,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "knowledge_chunks_source_unique" ON "knowledge_chunks" ("source_type", "source_id");
CREATE INDEX "knowledge_chunks_owner_idx" ON "knowledge_chunks" ("owner_user_id");

DO $migrate$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding" vector(768);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector unavailable; knowledge_chunks created without embedding column';
END
$migrate$;
