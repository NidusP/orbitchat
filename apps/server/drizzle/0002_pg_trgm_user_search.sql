CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "users_username_trgm_idx" ON "users" USING gin ("username" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "profiles_display_name_trgm_idx" ON "profiles" USING gin ("display_name" gin_trgm_ops);
