CREATE TABLE IF NOT EXISTS "uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "purpose" varchar(16) NOT NULL,
  "object_key" varchar(512) NOT NULL,
  "mime_type" varchar(64) NOT NULL,
  "size_bytes" integer NOT NULL,
  "status" varchar(16) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uploads_object_key_unique" ON "uploads" ("object_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_owner_status_idx" ON "uploads" ("owner_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_pending_expires_idx" ON "uploads" ("expires_at") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE cascade,
  "upload_id" uuid NOT NULL REFERENCES "uploads"("id"),
  "sort_order" smallint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "post_media_post_upload_unique" UNIQUE("post_id", "upload_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_media_post_id_idx" ON "post_media" ("post_id");
