CREATE TABLE "group_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "code" varchar(32) NOT NULL,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamptz,
  "max_uses" integer,
  "use_count" integer NOT NULL DEFAULT 0,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "group_invites_code_unique" ON "group_invites" ("code");
CREATE INDEX "group_invites_conversation_idx" ON "group_invites" ("conversation_id");
