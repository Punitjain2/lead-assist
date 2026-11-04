import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

const SECRET = process.env.AUTH_SECRET || "dev-secret-do-not-use-in-prod";

export type Session = { uid: string; role: string; name: string; exp: number };

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function makeToken(s: Omit<Session, "exp">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...s, exp: Date.now() + 7 * 24 * 3600 * 1000 })
  ).toString("base64url");
  return payload + "." + sign(payload);
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return verifyToken(cookies().get("session")?.value);
}

export async function getSessionUser() {
  const s = getSession();
  if (!s) return null;
  return prisma.user.findUnique({ where: { id: s.uid } });
}
