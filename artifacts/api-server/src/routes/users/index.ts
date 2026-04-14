import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { sendUserCreatedEmail } from "../../lib/emailService";
import {
  ListUsersResponse,
  CreateUserBody,
  GetUserParams,
  GetUserResponse,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
  DeleteUserParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function logAction(action: string, entityType: string, entityId: string, description: string) {
  try {
    await db.insert(auditLogsTable).values({
      action,
      entityType,
      entityId,
      description,
      username: "system",
    });
  } catch {
    // Non-fatal
  }
}

function hashPassword(pw: string): string {
  // Simple hash simulation for demo — in production use bcrypt
  return Buffer.from(pw).toString("base64");
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(users.map(formatUser)));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    username: parsed.data.username,
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    role: parsed.data.role,
    passwordHash: hashPassword(parsed.data.password),
    isActive: true,
  }).returning();

  await logAction("CREATE", "user", String(user.id), `User '${user.username}' (${user.fullName}) created with role '${user.role}'`);

  // Send email notification (non-blocking — don't fail on email error)
  sendUserCreatedEmail({
    name: user.fullName,
    username: user.username,
    email: user.email ?? "",
    role: user.role,
    tempPassword: parsed.data.password,
  }).catch(() => {});

  res.status(201).json(GetUserResponse.parse(formatUser(user)));
});

router.post("/users/bulk", async (req, res): Promise<void> => {
  const { users } = req.body as { users?: unknown[] };

  if (!Array.isArray(users) || users.length === 0) {
    res.status(400).json({ error: "users array is required" });
    return;
  }

  if (users.length > 200) {
    res.status(400).json({ error: "Maximum 200 users per import" });
    return;
  }

  const results: { row: number; username: string; status: "success" | "error"; message: string }[] = [];

  for (let i = 0; i < users.length; i++) {
    const row = users[i] as Record<string, unknown>;
    const rowNum = i + 1;

    const username = String(row.username ?? "").trim();
    const fullName = String(row.fullName ?? "").trim();
    const email = String(row.email ?? "").trim();
    const password = String(row.password ?? "").trim();
    const role = String(row.role ?? "viewer").trim().toLowerCase();

    if (!username || !password) {
      results.push({ row: rowNum, username: username || "(empty)", status: "error", message: "Username and password are required" });
      continue;
    }

    if (!["admin", "operator", "viewer"].includes(role)) {
      results.push({ row: rowNum, username, status: "error", message: `Invalid role '${role}' — must be admin, operator, or viewer` });
      continue;
    }

    try {
      const [user] = await db.insert(usersTable).values({
        username,
        fullName: fullName || username,
        email: email || null,
        role: role as "admin" | "operator" | "viewer",
        passwordHash: hashPassword(password),
        isActive: true,
      }).returning();

      await logAction("CREATE", "user", String(user.id), `Bulk import: user '${user.username}' created with role '${user.role}'`);

      if (email) {
        sendUserCreatedEmail({
          name: user.fullName,
          username: user.username,
          email,
          role: user.role,
          tempPassword: password,
        }).catch(() => {});
      }

      results.push({ row: rowNum, username, status: "success", message: "Created successfully" });
    } catch (err: any) {
      const isDuplicate = String(err?.message ?? "").includes("unique") || String(err?.code ?? "") === "23505";
      results.push({
        row: rowNum,
        username,
        status: "error",
        message: isDuplicate ? `Username '${username}' already exists` : String(err?.message ?? "Unknown error"),
      });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  res.status(200).json({ results, successCount, errorCount: results.length - successCount });
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetUserParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserResponse.parse(formatUser(user)));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUserParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.fullName != null) updateData.fullName = parsed.data.fullName;
  if (parsed.data.email != null) updateData.email = parsed.data.email;
  if (parsed.data.role != null) updateData.role = parsed.data.role;
  if (parsed.data.isActive != null) updateData.isActive = parsed.data.isActive;
  if (parsed.data.password) updateData.passwordHash = hashPassword(parsed.data.password);

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const changes = Object.entries(parsed.data)
    .filter(([k]) => k !== "password")
    .map(([k, v]) => `${k}: '${v}'`)
    .join(", ");
  await logAction("UPDATE", "user", String(user.id), `User '${user.username}' updated — ${changes}`);

  res.json(UpdateUserResponse.parse(formatUser(user)));
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteUserParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await logAction("DELETE", "user", String(user.id), `User '${user.username}' (${user.fullName}) deleted`);

  res.sendStatus(204);
});

export default router;
