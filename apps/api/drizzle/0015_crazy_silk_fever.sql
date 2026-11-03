DROP INDEX "idx_activity_project_time";--> statement-breakpoint
-- Existing rows take their ticket's project, so the column is added empty, filled, then made required.
ALTER TABLE "ticket_activity" ADD COLUMN "project_id" uuid;--> statement-breakpoint
UPDATE "ticket_activity" SET "project_id" = "tickets"."project_id" FROM "tickets" WHERE "tickets"."id" = "ticket_activity"."ticket_id";--> statement-breakpoint
ALTER TABLE "ticket_activity" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_time" ON "ticket_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_project_time" ON "ticket_activity" USING btree ("project_id","created_at" DESC NULLS LAST);
