CREATE TABLE IF NOT EXISTS "device_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"serial_number" text NOT NULL,
	"branch_name" text NOT NULL,
	"state_name" text NOT NULL,
	"status" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
