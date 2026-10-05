DROP TABLE "archive_requests" CASCADE;--> statement-breakpoint
DROP TABLE "authors" CASCADE;--> statement-breakpoint
DROP TABLE "editions" CASCADE;--> statement-breakpoint
DROP TABLE "passages" CASCADE;--> statement-breakpoint
DROP TABLE "physical_editions" CASCADE;--> statement-breakpoint
DROP TABLE "plates" CASCADE;--> statement-breakpoint
DROP TABLE "rights_records" CASCADE;--> statement-breakpoint
DROP TABLE "saved_passages" CASCADE;--> statement-breakpoint
DROP TABLE "saved_works" CASCADE;--> statement-breakpoint
DROP TABLE "sections" CASCADE;--> statement-breakpoint
DROP TABLE "sources" CASCADE;--> statement-breakpoint
DROP TABLE "subjects" CASCADE;--> statement-breakpoint
DROP TABLE "work_authors" CASCADE;--> statement-breakpoint
DROP TABLE "work_relations" CASCADE;--> statement-breakpoint
DROP TABLE "work_subjects" CASCADE;--> statement-breakpoint
DROP TABLE "works" CASCADE;--> statement-breakpoint
DROP INDEX "research_queries_visitor_idx";--> statement-breakpoint
DROP INDEX "research_queries_client_idx";--> statement-breakpoint
ALTER TABLE "research_queries" DROP COLUMN "visitor_id";--> statement-breakpoint
ALTER TABLE "research_queries" DROP COLUMN "client_hash";--> statement-breakpoint
-- The Archivist's history referred to the public archive; it does not carry over.
DELETE FROM "research_queries";--> statement-breakpoint
-- The paid plan is renamed.
UPDATE "entitlements" SET "plan" = 'fellow' WHERE "plan" = 'inner';
