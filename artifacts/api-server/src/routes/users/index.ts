import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, auditLogsTable } from "@workspace/db";
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

  res.status(201).json(GetUserResponse.parse(formatUser(user)));
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
