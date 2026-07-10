CREATE TABLE "ai_conversation_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
  "summary" text NOT NULL,
  "up_to_message_id" uuid NOT NULL REFERENCES "ai_messages"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "ai_conversation_summaries_conversation_id_unique" ON "ai_conversation_summaries" ("conversation_id");
