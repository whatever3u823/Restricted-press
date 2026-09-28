ALTER TABLE "research_queries" ADD COLUMN "client_hash" text;--> statement-breakpoint
CREATE INDEX "research_queries_client_idx" ON "research_queries" USING btree ("client_hash","created_at");