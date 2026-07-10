CREATE TABLE "message_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"editor_user_id" uuid NOT NULL,
	"previous_content" text NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_recalls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"recalled_by_user_id" uuid NOT NULL,
	"message_created_at" timestamp with time zone NOT NULL,
	"recalled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_edits" ADD CONSTRAINT "message_edits_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_edits" ADD CONSTRAINT "message_edits_editor_user_id_users_id_fk" FOREIGN KEY ("editor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_recalls" ADD CONSTRAINT "message_recalls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_recalls" ADD CONSTRAINT "message_recalls_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_recalls" ADD CONSTRAINT "message_recalls_recalled_by_user_id_users_id_fk" FOREIGN KEY ("recalled_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "message_edits_message_timeline_idx" ON "message_edits" USING btree ("message_id","edited_at");
--> statement-breakpoint
CREATE INDEX "message_recalls_conversation_timeline_idx" ON "message_recalls" USING btree ("conversation_id","message_created_at","id");
