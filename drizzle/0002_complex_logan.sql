CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"normalized_name" varchar(50) NOT NULL,
	"color" varchar(7) NOT NULL,
	"description" varchar(300),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "labels_name_length_check" CHECK (char_length(btrim("labels"."name")) BETWEEN 1 AND 50),
	CONSTRAINT "labels_normalized_name_length_check" CHECK (char_length("labels"."normalized_name") BETWEEN 1 AND 50),
	CONSTRAINT "labels_color_check" CHECK ("labels"."color" ~ '^#[0-9A-F]{6}$'),
	CONSTRAINT "labels_description_length_check" CHECK ("labels"."description" IS NULL OR char_length("labels"."description") <= 300),
	CONSTRAINT "labels_timestamp_order_check" CHECK ("labels"."updated_at" >= "labels"."created_at")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"trigger_type" varchar(20) NOT NULL,
	"remind_at" timestamp with time zone,
	"offset_minutes" integer,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "reminders_trigger_type_check" CHECK ("reminders"."trigger_type" IN ('absolute', 'before_due')),
	CONSTRAINT "reminders_status_check" CHECK ("reminders"."status" IN ('scheduled', 'cancelled')),
	CONSTRAINT "reminders_absolute_shape_check" CHECK (("reminders"."trigger_type" <> 'absolute') OR ("reminders"."remind_at" IS NOT NULL AND "reminders"."offset_minutes" IS NULL)),
	CONSTRAINT "reminders_before_due_shape_check" CHECK (("reminders"."trigger_type" <> 'before_due') OR ("reminders"."remind_at" IS NULL AND "reminders"."offset_minutes" BETWEEN 1 AND 43200)),
	CONSTRAINT "reminders_cancelled_at_check" CHECK (("reminders"."status" = 'cancelled' AND "reminders"."cancelled_at" IS NOT NULL) OR ("reminders"."status" = 'scheduled' AND "reminders"."cancelled_at" IS NULL)),
	CONSTRAINT "reminders_timestamp_order_check" CHECK ("reminders"."updated_at" >= "reminders"."created_at" AND ("reminders"."cancelled_at" IS NULL OR "reminders"."cancelled_at" >= "reminders"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"normalized_name" varchar(50) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tags_name_length_check" CHECK (char_length(btrim("tags"."name")) BETWEEN 1 AND 50),
	CONSTRAINT "tags_normalized_name_length_check" CHECK (char_length("tags"."normalized_name") BETWEEN 1 AND 50),
	CONSTRAINT "tags_timestamp_order_check" CHECK ("tags"."updated_at" >= "tags"."created_at")
);
--> statement-breakpoint
CREATE TABLE "todo_tags" (
	"todo_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "todo_tags_pkey" PRIMARY KEY("todo_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "label_id" uuid;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tags" ADD CONSTRAINT "todo_tags_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_tags" ADD CONSTRAINT "todo_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_workspace_id_normalized_name_uidx" ON "labels" USING btree ("workspace_id","normalized_name");--> statement-breakpoint
CREATE INDEX "labels_workspace_id_idx" ON "labels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "reminders_todo_id_idx" ON "reminders" USING btree ("todo_id");--> statement-breakpoint
CREATE INDEX "reminders_todo_id_status_idx" ON "reminders" USING btree ("todo_id","status");--> statement-breakpoint
CREATE INDEX "reminders_trigger_type_idx" ON "reminders" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "reminders_scheduled_absolute_remind_at_idx" ON "reminders" USING btree ("remind_at") WHERE "reminders"."status" = 'scheduled' AND "reminders"."trigger_type" = 'absolute';--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_absolute_schedule_uidx" ON "reminders" USING btree ("todo_id","remind_at") WHERE "reminders"."trigger_type" = 'absolute' AND "reminders"."status" = 'scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_before_due_schedule_uidx" ON "reminders" USING btree ("todo_id","offset_minutes") WHERE "reminders"."trigger_type" = 'before_due' AND "reminders"."status" = 'scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_id_normalized_name_uidx" ON "tags" USING btree ("workspace_id","normalized_name");--> statement-breakpoint
CREATE INDEX "tags_workspace_id_idx" ON "tags" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "todo_tags_tag_id_todo_id_idx" ON "todo_tags" USING btree ("tag_id","todo_id");--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_workspace_label_id_created_at_id_idx" ON "todos" USING btree ("workspace_id","label_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "todos"."deleted_at" IS NULL;