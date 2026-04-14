import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { createSession, getSession, deleteSession } from "../../lib/sessions";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const COOKIE_NAME = "session_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  maxAge: 60 * 60 * 24 * 7 * 1000,
  path: "/",
};

function checkPassword(plain: string, hash: string): boolean {
  return Buffer.from(plain).toString("base64") === hash;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

    if (!user || !checkPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is disabled. Contact your administrator." });
      return;
    }

    await db.update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const token = createSession(user.id, user.username, user.fullName, user.role);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    logger.info({ username: user.username, role: user.role }, "User logged in");

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? null,
      role: user.role,
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res): void => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) deleteSession(token);
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const session = getSession(token);
  if (!session) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user || !user.isActive) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Session invalid" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? null,
      role: user.role,
    });
  } catch (err) {
    logger.error({ err }, "auth/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/verify-password", async (req, res): Promise<void> => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user || !checkPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "verify-password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
