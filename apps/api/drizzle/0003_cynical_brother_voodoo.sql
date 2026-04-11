CREATE TYPE "public"."status_category" AS ENUM('backlog', 'active', 'done');--> statement-breakpoint
ALTER TABLE "statuses" ALTER COLUMN "category" SET DEFAULT 'active'::"public"."status_category";--> statement-breakpoint
ALTER TABLE "statuses" ALTER COLUMN "category" SET DATA TYPE "public"."status_category" USING "category"::"public"."status_category";