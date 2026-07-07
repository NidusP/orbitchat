CREATE TYPE "conversation_member_role" AS ENUM('owner', 'admin', 'member');
ALTER TABLE "conversation_members" ADD COLUMN "role" "conversation_member_role";

UPDATE "conversation_members" cm
SET "role" = 'owner'
FROM "conversations" c
WHERE cm."conversation_id" = c."id"
  AND c."type" = 'group'
  AND c."created_by_user_id" = cm."user_id";

UPDATE "conversation_members" cm
SET "role" = 'member'
FROM "conversations" c
WHERE cm."conversation_id" = c."id"
  AND c."type" = 'group'
  AND cm."role" IS NULL;
