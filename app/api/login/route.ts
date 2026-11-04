import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { makeToken } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(parsed.password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", makeToken({ uid: user.id, role: user.role, name: user.name }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 7 * 24 * 3600
  });
  return res;
}
