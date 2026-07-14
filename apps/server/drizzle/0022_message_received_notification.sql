ALTER TYPE "notification_type" ADD VALUE 'message_received';
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "post_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "conversation_id" uuid;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "message_id" uuid;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
