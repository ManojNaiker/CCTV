CREATE TABLE IF NOT EXISTS "dvr_storage" (
        "id" serial PRIMARY KEY NOT NULL,
        "state" text NOT NULL,
        "branch" text NOT NULL,
        "branch_camera_count" integer,
        "no_of_recording_camera" integer,
        "no_of_not_working_camera" integer,
        "last_recording" text,
        "activity_date" text NOT NULL,
        "total_recording_day" integer,
        "remark" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
