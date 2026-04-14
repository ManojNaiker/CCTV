import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { createSession, getSession, deleteSession } from "../../lib/sessions";
import { logger } from "../../lib/logger";
import { sendEmail, loadServerLogo } from "../../lib/emailService";

// In-memory OTP store: key = username, value = { otp, expiresAt }
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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
    res.status(400).json({ error: "Username / email and password are required" });
    return;
  }

  try {
    const identifier = username.trim();
    // Support login by username OR email
    const [user] = await db.select().from(usersTable).where(
      or(eq(usersTable.username, identifier), eq(usersTable.email, identifier))
    );

    if (!user || !checkPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid username/email or password" });
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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { username } = req.body as { username?: string };
  if (!username) {
    res.status(400).json({ error: "Username or email is required" });
    return;
  }

  try {
    const identifier = username.trim();
    const [user] = await db.select().from(usersTable).where(
      or(eq(usersTable.username, identifier), eq(usersTable.email, identifier))
    );
    if (!user || !user.isActive) {
      // Don't reveal if user exists — always respond success
      res.json({ ok: true });
      return;
    }

    if (!user.email) {
      res.status(422).json({ error: "No email address is linked to this account. Please contact your administrator." });
      return;
    }

    const otp = generateOtp();
    otpStore.set(username.trim(), { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });

    const logoBase64 = loadServerLogo();
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" alt="Light Finance" style="height:40px;width:auto;display:block;" />`
      : `<div style="background-color:#ffffff;border-radius:6px;padding:5px 12px;display:inline-block;"><span style="font-size:12px;font-weight:700;color:#1d4ed8;letter-spacing:0.5px;">LIGHT FINANCE</span></div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Password Reset OTP</title></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background-color:#1d4ed8;padding:28px 40px 24px;">
          ${logoHtml}
          <div style="margin-top:18px;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Password Reset Request</h1>
            <p style="margin:6px 0 0;font-size:13px;color:#bfdbfe;">CCTV Monitoring Portal</p>
          </div>
        </td>
      </tr>
      <tr><td style="background-color:#1e40af;height:4px;"></td></tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px 40px 0;">
          <p style="margin:0;font-size:15px;color:#111827;">Hi <strong>${user.fullName || user.username}</strong>,</p>
          <p style="margin:12px 0 0;font-size:14px;color:#4b5563;line-height:1.7;">
            We received a request to reset the password for your account on the
            <strong style="color:#1d4ed8;">Light Finance CCTV Monitoring Portal</strong>.
            Use the One-Time Password (OTP) below to complete the reset.
          </p>
        </td>
      </tr>

      <!-- OTP Box -->
      <tr>
        <td style="padding:28px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border:2px dashed #93c5fd;border-radius:10px;">
            <tr>
              <td style="padding:28px 20px;text-align:center;">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;">Your One-Time Password</p>
                <div style="font-family:Courier New,monospace;font-size:40px;font-weight:700;color:#1d4ed8;letter-spacing:14px;line-height:1;">${otp}</div>
                <p style="margin:14px 0 0;font-size:12px;color:#6b7280;">Valid for <strong>10 minutes</strong> only</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Warning -->
      <tr>
        <td style="padding:20px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:4px;">
            <tr>
              <td style="padding:12px 16px;">
                <p style="margin:0;font-size:13px;color:#9a3412;">
                  &#9888;&nbsp;<strong>Did not request this?</strong> If you did not request a password reset, please ignore this email. Your account remains secure.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Divider + Sign-off -->
      <tr><td style="padding:28px 40px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
      <tr>
        <td style="padding:20px 40px 0;">
          <p style="margin:0;font-size:14px;color:#374151;">Thanks &amp; Regards,</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111827;">IT Team</p>
          <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Light Finance &mdash; CCTV Monitoring System</p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #f3f4f6;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                  This is an automated notification from the <strong>Light Finance CCTV Monitoring System</strong>.<br>
                  Please do not reply to this email. For assistance, contact your IT administrator.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    await sendEmail("Password Reset OTP — Light Finance CCTV Portal", html, undefined, [user.email]);
    logger.info({ username: user.username }, "OTP sent for password reset");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "forgot-password error");
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { username, otp, newPassword } = req.body as { username?: string; otp?: string; newPassword?: string };

  if (!username || !otp || !newPassword) {
    res.status(400).json({ error: "Username, OTP, and new password are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const stored = otpStore.get(username.trim());
  if (!stored) {
    res.status(400).json({ error: "No OTP was requested for this user. Please request a new OTP." });
    return;
  }
  if (stored.expiresAt < new Date()) {
    otpStore.delete(username.trim());
    res.status(400).json({ error: "OTP has expired. Please request a new one." });
    return;
  }
  if (stored.otp !== otp.trim()) {
    res.status(400).json({ error: "Incorrect OTP. Please check and try again." });
    return;
  }

  try {
    const identifier = username.trim();
    const [user] = await db.select().from(usersTable).where(
      or(eq(usersTable.username, identifier), eq(usersTable.email, identifier))
    );
    if (!user || !user.isActive) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordHash = Buffer.from(newPassword).toString("base64");
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    otpStore.delete(username.trim());

    logger.info({ username: user.username }, "Password reset successful");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset-password error");
    res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

export default router;
