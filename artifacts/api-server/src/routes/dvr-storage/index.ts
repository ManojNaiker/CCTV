import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dvrStorageTable, devicesTable } from "@workspace/db";

const router: IRouter = Router();

function getISTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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

// POST /api/dvr-storage/initialize — create rows for all unique branches for today
router.post("/dvr-storage/initialize", async (req, res): Promise<void> => {
  try {
    const today = getISTDate();

    // Get all unique branches from devices
    const devices = await db
      .selectDistinctOn([devicesTable.branchName], {
        branch: devicesTable.branchName,
        state: devicesTable.stateName,
      })
      .from(devicesTable)
      .orderBy(devicesTable.branchName);

    // Get existing records for today
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
    }

    const records = await db
      .select()
      .from(dvrStorageTable)
      .where(eq(dvrStorageTable.activityDate, today))
      .orderBy(dvrStorageTable.state, dvrStorageTable.branch);

    res.json({ created: toInsert.length, records });
  } catch (err) {
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

    // Auto-determine status
    const [existing] = await db.select().from(dvrStorageTable).where(eq(dvrStorageTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    const merged = { ...existing, ...updateData };
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

export default router;
