import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"));
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}
