CREATE TABLE IF NOT EXISTS "message_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE cascade,
  "upload_id" uuid NOT NULL REFERENCES "uploads"("id"),
  "sort_order" smallint NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "message_media_message_upload_unique" UNIQUE("message_id", "upload_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_media_message_id_idx" ON "message_media" ("message_id");
