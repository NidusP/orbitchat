DO $$ BEGIN
  CREATE TYPE "notification_type" AS ENUM ('post_liked', 'post_commented');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" "notification_type" NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE cascade,
  "comment_id" uuid REFERENCES "comments"("id") ON DELETE set null,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_timeline_idx" ON "notifications" ("recipient_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_unread_idx" ON "notifications" ("recipient_id") WHERE "read_at" IS NULL;
