CREATE TABLE "collection_documents" (
	"collection_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	CONSTRAINT "collection_documents_collection_id_document_id_pk" PRIMARY KEY("collection_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"year" integer,
	"kind" text DEFAULT 'book' NOT NULL,
	"format" text NOT NULL,
	"filename" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"reading_status" text DEFAULT 'unread' NOT NULL,
	"abstract" text,
	"subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"section_count" integer DEFAULT 0 NOT NULL,
	"last_section" integer,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"passage_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"owner_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text DEFAULT 'paragraph' NOT NULL,
	"text" text NOT NULL,
	"word_count" integer NOT NULL,
	"page" integer,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', unaccent_immutable(text))) STORED
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_documents" ADD CONSTRAINT "collection_documents_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_documents" ADD CONSTRAINT "collection_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_owner_name" ON "collections" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "highlights_user_passage" ON "highlights" USING btree ("user_id","passage_id");--> statement-breakpoint
CREATE INDEX "passages_search_idx" ON "passages" USING gin ("search");--> statement-breakpoint
CREATE INDEX "passages_document_ordinal_idx" ON "passages" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX "passages_owner_idx" ON "passages" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_document_ordinal" ON "sections" USING btree ("document_id","ordinal");