CREATE TABLE "workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"normalized_email" varchar(320) NOT NULL,
	"role" varchar(20) NOT NULL,
	"token_hash" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"invited_by" uuid NOT NULL,
	"accepted_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"delivery_status" varchar(20) NOT NULL,
	"email_sent_at" timestamp with time zone,
	"email_last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workspace_invitations_role_check" CHECK ("workspace_invitations"."role" IN ('admin', 'member')),
	CONSTRAINT "workspace_invitations_status_check" CHECK ("workspace_invitations"."status" IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
	CONSTRAINT "workspace_invitations_delivery_status_check" CHECK ("workspace_invitations"."delivery_status" IN ('pending', 'sent', 'failed')),
	CONSTRAINT "workspace_invitations_state_check" CHECK ((
        ("workspace_invitations"."status" = 'pending' AND "workspace_invitations"."accepted_at" IS NULL AND "workspace_invitations"."accepted_by" IS NULL AND "workspace_invitations"."declined_at" IS NULL AND "workspace_invitations"."revoked_at" IS NULL)
        OR ("workspace_invitations"."status" = 'expired' AND "workspace_invitations"."accepted_at" IS NULL AND "workspace_invitations"."accepted_by" IS NULL AND "workspace_invitations"."declined_at" IS NULL AND "workspace_invitations"."revoked_at" IS NULL)
        OR ("workspace_invitations"."status" = 'accepted' AND "workspace_invitations"."accepted_at" IS NOT NULL AND "workspace_invitations"."accepted_by" IS NOT NULL AND "workspace_invitations"."declined_at" IS NULL AND "workspace_invitations"."revoked_at" IS NULL)
        OR ("workspace_invitations"."status" = 'declined' AND "workspace_invitations"."declined_at" IS NOT NULL AND "workspace_invitations"."accepted_at" IS NULL AND "workspace_invitations"."accepted_by" IS NULL AND "workspace_invitations"."revoked_at" IS NULL)
        OR ("workspace_invitations"."status" = 'revoked' AND "workspace_invitations"."revoked_at" IS NOT NULL AND "workspace_invitations"."accepted_at" IS NULL AND "workspace_invitations"."accepted_by" IS NULL AND "workspace_invitations"."declined_at" IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_token_hash_uidx" ON "workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_pending_email_uidx" ON "workspace_invitations" USING btree ("workspace_id","normalized_email") WHERE "workspace_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_id_idx" ON "workspace_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invitations_normalized_email_idx" ON "workspace_invitations" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "workspace_invitations_status_idx" ON "workspace_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workspace_invitations_expires_at_idx" ON "workspace_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspace_created_at_id_idx" ON "workspace_invitations" USING btree ("workspace_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owner_uidx" ON "workspace_members" USING btree ("workspace_id") WHERE "workspace_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_joined_at_user_id_idx" ON "workspace_members" USING btree ("workspace_id","joined_at" DESC NULLS LAST,"user_id" DESC NULLS LAST);