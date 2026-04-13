import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dvrStorageTable, devicesTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { sendDvrReportManual } from "../../lib/emailService";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join, extname } from "path";
import { UPLOADS_DIR } from "../../app";

const router: IRouter = Router();

function getISTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function calcTotalDays(lastRecording: string | null, activityDate: string): number | null {
  if (!lastRecording) return null;
  const last = new Date(lastRecording).getTime();
  const activity = new Date(activityDate).getTime();
  if (isNaN(last) || isNaN(activity)) return null;
  const diff = Math.round((activity - last) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function isCompleted(record: {
  branchCameraCount: number | null;
  noOfRecordingCamera: number | null;
  noOfNotWorkingCamera: number | null;
  lastRecording: string | null;
  totalRecordingDay: number | null;
}): boolean {
  return (
    record.branchCameraCount !== null &&
    record.noOfRecordingCamera !== null &&
    record.noOfNotWorkingCamera !== null &&
    record.lastRecording !== null &&
    record.lastRecording.trim() !== "" &&
    record.totalRecordingDay !== null
  );
}

// GET /api/dvr-storage?date=YYYY-MM-DD
router.get("/dvr-storage", async (req, res): Promise<void> => {
  try {
    const date = (req.query["date"] as string) || getISTDate();
    const records = await db
      .select()
      .from(dvrStorageTable)
      .where(eq(dvrStorageTable.activityDate, date))
      .orderBy(dvrStorageTable.state, dvrStorageTable.branch);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch DVR storage records" });
  }
});

// POST /api/dvr-storage/initialize
// body: { mode: "new" | "update" }
//   "new"    → delete all existing records for today, insert fresh blank rows for all branches
//   "update" → keep existing, only insert rows for branches that don't have a record yet
router.post("/dvr-storage/initialize", async (req, res): Promise<void> => {
  try {
    const today = getISTDate();
    const mode: "new" | "update" = req.body?.mode === "new" ? "new" : "update";

    // Get all unique branches from devices
    const devices = await db
      .selectDistinctOn([devicesTable.branchName], {
        branch: devicesTable.branchName,
        state: devicesTable.stateName,
      })
      .from(devicesTable)
      .orderBy(devicesTable.branchName);

    let created = 0;

    if (mode === "new") {
      // Delete all existing records for today then insert fresh blank rows
      await db.delete(dvrStorageTable).where(eq(dvrStorageTable.activityDate, today));

      if (devices.length > 0) {
        await db.insert(dvrStorageTable).values(
          devices.map((d) => ({
            state: d.state,
            branch: d.branch,
            activityDate: today,
            status: "pending",
            branchCameraCount: null,
            noOfRecordingCamera: null,
            noOfNotWorkingCamera: null,
            lastRecording: null,
            totalRecordingDay: null,
            remark: null,
          }))
        );
        created = devices.length;
      }
    } else {
      // Update mode: only add branches not yet present for today
      const existing = await db
        .select({ branch: dvrStorageTable.branch })
        .from(dvrStorageTable)
        .where(eq(dvrStorageTable.activityDate, today));

      const existingBranches = new Set(existing.map((r) => r.branch));
      const toInsert = devices.filter((d) => !existingBranches.has(d.branch));

      if (toInsert.length > 0) {
        await db.insert(dvrStorageTable).values(
          toInsert.map((d) => ({
            state: d.state,
            branch: d.branch,
            activityDate: today,
            status: "pending",
          }))
        );
        created = toInsert.length;
      }
    }

    const records = await db
      .select()
      .from(dvrStorageTable)
      .where(eq(dvrStorageTable.activityDate, today))
      .orderBy(dvrStorageTable.state, dvrStorageTable.branch);

    res.json({ created, mode, records });
  } catch (err) {
    logger.error({ err }, "Failed to initialize DVR storage records");
    res.status(500).json({ error: "Failed to initialize DVR storage records" });
  }
});

// PATCH /api/dvr-storage/:id
router.patch("/dvr-storage/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const {
      branchCameraCount,
      noOfRecordingCamera,
      noOfNotWorkingCamera,
      lastRecording,
      totalRecordingDay,
      remark,
    } = req.body;

    const updateData: Record<string, unknown> = {};
    if (branchCameraCount !== undefined) updateData["branchCameraCount"] = branchCameraCount === "" ? null : Number(branchCameraCount);
    if (noOfRecordingCamera !== undefined) updateData["noOfRecordingCamera"] = noOfRecordingCamera === "" ? null : Number(noOfRecordingCamera);
    if (noOfNotWorkingCamera !== undefined) updateData["noOfNotWorkingCamera"] = noOfNotWorkingCamera === "" ? null : Number(noOfNotWorkingCamera);
    if (lastRecording !== undefined) updateData["lastRecording"] = lastRecording || null;
    if (totalRecordingDay !== undefined) updateData["totalRecordingDay"] = totalRecordingDay === "" ? null : Number(totalRecordingDay);
    if (remark !== undefined) updateData["remark"] = remark || null;
    if (req.body.imageUrl !== undefined) updateData["imageUrl"] = req.body.imageUrl || null;

    const [existing] = await db.select().from(dvrStorageTable).where(eq(dvrStorageTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    const merged = { ...existing, ...updateData };

    // Always auto-compute totalRecordingDay from lastRecording + activityDate
    const autoTotalDays = calcTotalDays(
      merged.lastRecording as string | null,
      merged.activityDate as string
    );
    updateData["totalRecordingDay"] = autoTotalDays;
    merged.totalRecordingDay = autoTotalDays;

    updateData["status"] = isCompleted({
      branchCameraCount: merged.branchCameraCount as number | null,
      noOfRecordingCamera: merged.noOfRecordingCamera as number | null,
      noOfNotWorkingCamera: merged.noOfNotWorkingCamera as number | null,
      lastRecording: merged.lastRecording as string | null,
      totalRecordingDay: merged.totalRecordingDay as number | null,
    })
      ? "completed"
      : "pending";

    const [updated] = await db
      .update(dvrStorageTable)
      .set(updateData)
      .where(eq(dvrStorageTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update DVR storage record" });
  }
});

// POST /api/dvr-storage/:id/image — upload image (base64) for a DVR record
router.post("/dvr-storage/:id/image", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { imageData } = req.body as { imageData?: string };
    if (!imageData) { res.status(400).json({ error: "imageData is required" }); return; }

    const match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) { res.status(400).json({ error: "Invalid image format. Expected data URI." }); return; }

    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");

    const [existing] = await db.select().from(dvrStorageTable).where(eq(dvrStorageTable.id, id));
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    // Delete old image if it exists
    if (existing.imageUrl) {
      const oldFile = join(UPLOADS_DIR, existing.imageUrl.split("/").pop() ?? "");
      if (existsSync(oldFile)) { try { unlinkSync(oldFile); } catch { } }
    }

    const filename = `dvr_${id}_${Date.now()}.${ext}`;
    writeFileSync(join(UPLOADS_DIR, filename), buffer);

    const imageUrl = `/api/uploads/${filename}`;
    const [updated] = await db.update(dvrStorageTable).set({ imageUrl }).where(eq(dvrStorageTable.id, id)).returning();
    res.json({ imageUrl, record: updated });
  } catch (err) {
    logger.error({ err }, "Failed to upload DVR image");
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// DELETE /api/dvr-storage/:id/image — remove image for a DVR record
router.delete("/dvr-storage/:id/image", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select().from(dvrStorageTable).where(eq(dvrStorageTable.id, id));
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    if (existing.imageUrl) {
      const oldFile = join(UPLOADS_DIR, existing.imageUrl.split("/").pop() ?? "");
      if (existsSync(oldFile)) { try { unlinkSync(oldFile); } catch { } }
    }

    const [updated] = await db.update(dvrStorageTable).set({ imageUrl: null }).where(eq(dvrStorageTable.id, id)).returning();
    res.json({ success: true, record: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// DELETE /api/dvr-storage/:id
router.delete("/dvr-storage/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    await db.delete(dvrStorageTable).where(eq(dvrStorageTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete DVR storage record" });
  }
});

// POST /api/dvr-storage/send-email
// body: { date: string, to: string[], cc?: string[] }
router.post("/dvr-storage/send-email", async (req, res): Promise<void> => {
  try {
    const date: string = req.body?.date || getISTDate();
    const to: string[] = (req.body?.to ?? []).map((e: string) => e.trim()).filter(Boolean);
    const cc: string[] = (req.body?.cc ?? []).map((e: string) => e.trim()).filter(Boolean);

    if (to.length === 0) {
      res.status(400).json({ error: "At least one To recipient is required" });
      return;
    }

    const result = await sendDvrReportManual({ date, to, cc });

    if (!result.sent) {
      res.status(422).json({ error: result.reason });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to send DVR report email");
    res.status(500).json({ error: "Failed to send email" });
  }
});

// POST /api/dvr-storage/bulk-update
// body: { date: string, records: Array<{ branch, branchCameraCount?, noOfRecordingCamera?, noOfNotWorkingCamera?, lastRecording?, remark? }> }
router.post("/dvr-storage/bulk-update", async (req, res): Promise<void> => {
  try {
    const date: string = req.body?.date || getISTDate();
    const rows: Array<{
      branch: string;
      branchCameraCount?: string | number | null;
      noOfRecordingCamera?: string | number | null;
      noOfNotWorkingCamera?: string | number | null;
      lastRecording?: string | null;
      remark?: string | null;
    }> = req.body?.records ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "No records provided" });
      return;
    }

    const existing = await db
      .select()
      .from(dvrStorageTable)
      .where(eq(dvrStorageTable.activityDate, date));

    const existingMap = new Map(existing.map((r) => [r.branch.trim().toLowerCase(), r]));

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const branchKey = (row.branch ?? "").trim().toLowerCase();
      if (!branchKey) { skipped++; continue; }

      const record = existingMap.get(branchKey);
      if (!record) { skipped++; continue; }

      const toNum = (v: string | number | null | undefined): number | null => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const updateData: Record<string, unknown> = {};

      if (row.branchCameraCount !== undefined) updateData["branchCameraCount"] = toNum(row.branchCameraCount);
      if (row.noOfRecordingCamera !== undefined) updateData["noOfRecordingCamera"] = toNum(row.noOfRecordingCamera);
      if (row.noOfNotWorkingCamera !== undefined) updateData["noOfNotWorkingCamera"] = toNum(row.noOfNotWorkingCamera);
      if (row.lastRecording !== undefined) updateData["lastRecording"] = row.lastRecording || null;
      if (row.remark !== undefined) updateData["remark"] = row.remark || null;

      const merged = { ...record, ...updateData };
      const autoTotalDays = calcTotalDays(merged.lastRecording as string | null, merged.activityDate);
      updateData["totalRecordingDay"] = autoTotalDays;
      merged.totalRecordingDay = autoTotalDays;

      updateData["status"] = isCompleted({
        branchCameraCount: merged.branchCameraCount as number | null,
        noOfRecordingCamera: merged.noOfRecordingCamera as number | null,
        noOfNotWorkingCamera: merged.noOfNotWorkingCamera as number | null,
        lastRecording: merged.lastRecording as string | null,
        totalRecordingDay: merged.totalRecordingDay as number | null,
      }) ? "completed" : "pending";

      await db.update(dvrStorageTable).set(updateData).where(eq(dvrStorageTable.id, record.id));
      updated++;
    }

    res.json({ updated, skipped, total: rows.length });
  } catch (err) {
    logger.error({ err }, "Failed to bulk update DVR storage records");
    res.status(500).json({ error: "Failed to bulk update records" });
  }
});

export default router;
