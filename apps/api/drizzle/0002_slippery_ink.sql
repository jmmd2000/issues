ALTER TABLE "projects" ADD COLUMN "repo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stack" text[] DEFAULT '{}' NOT NULL;