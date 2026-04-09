import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const deviceStatusHistoryTable = pgTable("device_status_history", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  serialNumber: text("serial_number").notNull(),
  branchName: text("branch_name").notNull(),
  stateName: text("state_name").notNull(),
  status: text("status").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeviceStatusHistory = typeof deviceStatusHistoryTable.$inferSelect;
