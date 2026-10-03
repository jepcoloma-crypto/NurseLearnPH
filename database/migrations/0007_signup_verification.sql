ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;--> statement-breakpoint
-- Pre-existing accounts predate self-signup: treat them as verified (admin/seed provisioned).
UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL;--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_idx" ON "email_verification_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" ("user_id");
