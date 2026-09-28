CREATE TABLE "archive_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"user_id" text,
	"email" text,
	"title" text NOT NULL,
	"author" text,
	"notes" text,
	"work_id" integer,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archive_requests" ADD CONSTRAINT "archive_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_requests" ADD CONSTRAINT "archive_requests_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archive_requests_kind_idx" ON "archive_requests" USING btree ("kind","created_at");