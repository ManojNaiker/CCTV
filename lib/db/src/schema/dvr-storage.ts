import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const dvrStorageTable = pgTable("dvr_storage", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  branch: text("branch").notNull(),
  branchCameraCount: integer("branch_camera_count"),
  noOfRecordingCamera: integer("no_of_recording_camera"),
  noOfNotWorkingCamera: integer("no_of_not_working_camera"),
  lastRecording: text("last_recording"),
  activityDate: text("activity_date").notNull(),
  totalRecordingDay: integer("total_recording_day"),
  remark: text("remark"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type DvrStorage = typeof dvrStorageTable.$inferSelect;
