CREATE TYPE "public"."ai_tool_call_status" AS ENUM('pending', 'approved', 'rejected', 'executed', 'failed');--> statement-breakpoint
CREATE TABLE "ai_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"tool_name" varchar(64) NOT NULL,
	"status" "ai_tool_call_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tool_calls" ADD CONSTRAINT "ai_tool_calls_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_tool_calls_conversation_created_idx" ON "ai_tool_calls" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_tool_calls_user_status_idx" ON "ai_tool_calls" USING btree ("requested_by_user_id","status");