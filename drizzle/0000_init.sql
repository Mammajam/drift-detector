CREATE TYPE "public"."capture_theme" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."drift_status" AS ENUM('open', 'fixed', 'wont_fix');--> statement-breakpoint
CREATE TABLE "capture_images" (
	"capture_id" uuid PRIMARY KEY NOT NULL,
	"design_png" "bytea" NOT NULL,
	"build_png" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"url" text NOT NULL,
	"commit_sha" text DEFAULT '' NOT NULL,
	"theme" "capture_theme" NOT NULL,
	"breakpoint" integer NOT NULL,
	"frame_width" integer NOT NULL,
	"frame_height" integer NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capture_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"expected" text NOT NULL,
	"actual" text NOT NULL,
	"token" text,
	"bbox" jsonb NOT NULL,
	"status" "drift_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drifts_capture_key_unique" UNIQUE("capture_id","key")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"path" text NOT NULL,
	"figma_file_key" text NOT NULL,
	"figma_node_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_project_path_unique" UNIQUE("project_id","path")
);
--> statement-breakpoint
CREATE TABLE "signoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"capture_id" uuid NOT NULL,
	"approved_by" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture_images" ADD CONSTRAINT "capture_images_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captures" ADD CONSTRAINT "captures_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drifts" ADD CONSTRAINT "drifts_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "captures_route_created_idx" ON "captures" USING btree ("route_id","created_at");