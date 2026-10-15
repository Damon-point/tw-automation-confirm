import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { err, setSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";

export const runtime = "nodejs";

// 같은 주소에서 연달아 틀리면 잠시 막는다(서버리스라 인스턴스마다 따로 센다 — 대략의 방어)
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const f = fails.get(ip);
  if (f && f.until > Date.now()) return err(429, "로그인을 너무 많이 틀렸습니다. 잠시 뒤 다시 시도하세요");

  const { username = "", password = "" } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  await ensureSchema();
  const rows = await sql<{ username: string; password_hash: string }[]>`
    select username, password_hash from confirm_users where username = ${username.trim()} and active`;
  const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
  if (!ok) {
    const n = (f?.n ?? 0) + 1;
    fails.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60_000 : 0 });
    return err(401, "아이디 또는 비밀번호가 맞지 않습니다");
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  setSession(res, rows[0].username, new URL(req.url).protocol === "https:");
  return res;
}
