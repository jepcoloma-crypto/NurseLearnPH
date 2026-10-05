CREATE TABLE "module_settings" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "module_settings" ADD CONSTRAINT "module_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
