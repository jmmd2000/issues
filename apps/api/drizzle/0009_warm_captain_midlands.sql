CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"comment_id" uuid,
	"uploader_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"mime_type" text NOT NULL,
	"is_image" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_attachments_owner" CHECK (("attachments"."ticket_id" IS NOT NULL) OR ("attachments"."comment_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_ticket" ON "attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_comment" ON "attachments" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_hash" ON "attachments" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_tickets_visibility" ON "tickets" USING btree ("project_id") WHERE "tickets"."visibility" = 'private';