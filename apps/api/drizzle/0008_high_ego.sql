CREATE TYPE "public"."link_type" AS ENUM('blocks', 'depends_on', 'duplicates', 'relates_to');--> statement-breakpoint
CREATE TABLE "ticket_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_ticket_id" uuid NOT NULL,
	"target_ticket_id" uuid NOT NULL,
	"link_type" "link_type" NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ticket_links" UNIQUE("source_ticket_id","target_ticket_id","link_type"),
	CONSTRAINT "ck_ticket_links_no_self" CHECK ("ticket_links"."source_ticket_id" <> "ticket_links"."target_ticket_id")
);
--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ticket_links_source" ON "ticket_links" USING btree ("source_ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_links_target" ON "ticket_links" USING btree ("target_ticket_id");