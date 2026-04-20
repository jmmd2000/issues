CREATE TYPE "public"."activity_action" AS ENUM('created', 'updated', 'deleted', 'restored', 'label_added', 'label_removed', 'comment_added', 'comment_edited', 'comment_deleted', 'link_added', 'link_removed', 'attachment_added', 'attachment_removed');--> statement-breakpoint
CREATE TABLE "ticket_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_action" "activity_action" NOT NULL,
	"field_name" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_activity" ADD CONSTRAINT "ticket_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_ticket_time" ON "ticket_activity" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_project_time" ON "ticket_activity" USING btree ("created_at");