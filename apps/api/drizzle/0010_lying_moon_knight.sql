ALTER TYPE "public"."activity_action" ADD VALUE 'cloned_from' BEFORE 'label_added';--> statement-breakpoint
ALTER TYPE "public"."link_type" ADD VALUE 'clones';--> statement-breakpoint
CREATE INDEX "idx_tickets_project_trash" ON "tickets" USING btree ("project_id","deleted_at") WHERE "tickets"."deleted_at" IS NOT NULL;