import { randomUUID } from "node:crypto";

type Session = {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  expiresAt: Date;
};

const sessions = new Map<string, Session>();

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function createSession(userId: number, username: string, fullName: string, role: string): string {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  sessions.set(token, { userId, username, fullName, role, expiresAt });
  return token;
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}
