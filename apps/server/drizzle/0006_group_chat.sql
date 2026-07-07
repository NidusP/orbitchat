ALTER TYPE "conversation_type" ADD VALUE 'group';
ALTER TABLE "conversations" ADD COLUMN "title" varchar(120);
ALTER TABLE "conversations" ADD COLUMN "created_by_user_id" uuid;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
