CREATE TABLE "user_agent_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "kind" varchar(32) NOT NULL,
  "content" text NOT NULL,
  "source" varchar(32) NOT NULL,
  "conversation_id" uuid REFERENCES "ai_conversations"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX "user_agent_memories_user_deleted_idx" ON "user_agent_memories" ("user_id", "deleted_at");
