CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "todos_status_check" CHECK ("todos"."status" IN ('todo', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "todos_priority_check" CHECK ("todos"."priority" IN ('low', 'medium', 'high', 'urgent')),
	CONSTRAINT "todos_title_length_check" CHECK (char_length(btrim("todos"."title")) BETWEEN 1 AND 200),
	CONSTRAINT "todos_description_length_check" CHECK ("todos"."description" IS NULL OR char_length("todos"."description") <= 5000),
	CONSTRAINT "todos_completed_at_check" CHECK (("todos"."status" = 'completed' AND "todos"."completed_at" IS NOT NULL) OR ("todos"."status" <> 'completed' AND "todos"."completed_at" IS NULL)),
	CONSTRAINT "todos_timestamp_order_check" CHECK ("todos"."updated_at" >= "todos"."created_at" AND ("todos"."deleted_at" IS NULL OR "todos"."deleted_at" >= "todos"."created_at"))
);
--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_workspace_created_at_id_idx" ON "todos" USING btree ("workspace_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "todos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "todos_workspace_status_created_at_id_idx" ON "todos" USING btree ("workspace_id","status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "todos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "todos_workspace_priority_created_at_id_idx" ON "todos" USING btree ("workspace_id","priority","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "todos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "todos_workspace_due_at_idx" ON "todos" USING btree ("workspace_id","due_at") WHERE "todos"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "todos_workspace_deleted_at_idx" ON "todos" USING btree ("workspace_id","deleted_at");