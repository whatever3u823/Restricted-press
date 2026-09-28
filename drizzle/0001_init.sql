CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_name" text NOT NULL,
	"birth_year" integer,
	"death_year" integer,
	"note" text,
	"note_status" text DEFAULT 'curatorial_draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_id" integer NOT NULL,
	"label" text NOT NULL,
	"publisher" text,
	"place" text,
	"year" integer,
	"year_basis" text DEFAULT 'unknown' NOT NULL,
	"edition_statement" text,
	"imprint" text,
	"notes" text,
	"is_archive_text" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" text PRIMARY KEY NOT NULL,
	"work_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"kind" text DEFAULT 'paragraph' NOT NULL,
	"text" text NOT NULL,
	"word_count" integer NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', unaccent_immutable(text))) STORED
);
--> statement-breakpoint
CREATE TABLE "physical_editions" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_id" integer NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plates" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_id" integer NOT NULL,
	"path" text NOT NULL,
	"caption" text,
	"ordinal" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"visitor_id" text,
	"question" text NOT NULL,
	"mode" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rights_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_id" integer NOT NULL,
	"component" text NOT NULL,
	"status" text NOT NULL,
	"confidence" text NOT NULL,
	"jurisdiction" text DEFAULT 'US' NOT NULL,
	"basis" text NOT NULL,
	"notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_passages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"passage_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_works" (
	"user_id" text NOT NULL,
	"work_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_works_user_id_work_id_pk" PRIMARY KEY("user_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"matter" text DEFAULT 'body' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"edition_id" integer NOT NULL,
	"kind" text DEFAULT 'transcription' NOT NULL,
	"provider" text NOT NULL,
	"identifier" text,
	"url" text,
	"retrieved_from" text,
	"retrieved_at" timestamp with time zone,
	"checksum" text,
	"transcription_notes" text,
	"provider_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_authors" (
	"work_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"role" text DEFAULT 'author' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "work_authors_work_id_author_id_role_pk" PRIMARY KEY("work_id","author_id","role")
);
--> statement-breakpoint
CREATE TABLE "work_relations" (
	"from_work_id" integer NOT NULL,
	"to_work_id" integer NOT NULL,
	"kind" text DEFAULT 'related' NOT NULL,
	"note" text,
	"basis" text DEFAULT 'curatorial' NOT NULL,
	CONSTRAINT "work_relations_from_work_id_to_work_id_kind_pk" PRIMARY KEY("from_work_id","to_work_id","kind")
);
--> statement-breakpoint
CREATE TABLE "work_subjects" (
	"work_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	CONSTRAINT "work_subjects_work_id_subject_id_pk" PRIMARY KEY("work_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" serial PRIMARY KEY NOT NULL,
	"accession" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"original_year" integer,
	"original_year_basis" text DEFAULT 'unknown' NOT NULL,
	"original_language" text,
	"category_id" integer,
	"summary" text,
	"historical_context" text,
	"archivist_notes" text,
	"content_status" text DEFAULT 'curatorial_draft' NOT NULL,
	"publication_status" text DEFAULT 'draft' NOT NULL,
	"access_level" text DEFAULT 'open' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"archivist_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "works_accession_unique" UNIQUE("accession"),
	CONSTRAINT "works_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passages" ADD CONSTRAINT "passages_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physical_editions" ADD CONSTRAINT "physical_editions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plates" ADD CONSTRAINT "plates_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_queries" ADD CONSTRAINT "research_queries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rights_records" ADD CONSTRAINT "rights_records_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_passages" ADD CONSTRAINT "saved_passages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_passages" ADD CONSTRAINT "saved_passages_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_works" ADD CONSTRAINT "saved_works_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_works" ADD CONSTRAINT "saved_works_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_relations" ADD CONSTRAINT "work_relations_from_work_id_works_id_fk" FOREIGN KEY ("from_work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_relations" ADD CONSTRAINT "work_relations_to_work_id_works_id_fk" FOREIGN KEY ("to_work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_subjects" ADD CONSTRAINT "work_subjects_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_subjects" ADD CONSTRAINT "work_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_category_id_subjects_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entitlements_user_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passages_search_idx" ON "passages" USING gin ("search");--> statement-breakpoint
CREATE INDEX "passages_work_ordinal_idx" ON "passages" USING btree ("work_id","ordinal");--> statement-breakpoint
CREATE INDEX "research_queries_user_idx" ON "research_queries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "research_queries_visitor_idx" ON "research_queries" USING btree ("visitor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_passages_user_passage" ON "saved_passages" USING btree ("user_id","passage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_work_ordinal" ON "sections" USING btree ("work_id","ordinal");--> statement-breakpoint
CREATE INDEX "works_status_idx" ON "works" USING btree ("publication_status");