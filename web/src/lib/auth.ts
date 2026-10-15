import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureSchema, KINDS, sql, type Kind } from "./db";

/**
 * 로그인 세션 — 서명한 쿠키(HMAC-SHA256). 결재자 계정은 3080 이 올려 준 것만 쓴다.
 * 요청마다 계정을 다시 읽어, 3080 에서 지우거나 역할을 바꾸면 바로 반영된다.
 */
const COOKIE = "twc_session";
const MAX_AGE = 60 * 60 * 12;

export type Me = { username: string; display_name: string; role: string; email: string };

function secret(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET 가 없거나 짧습니다");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeToken(username: string): string {
  const body = Buffer.from(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u: string; exp: number };
    return p.exp > Date.now() / 1000 ? p.u : null;
  } catch {
    return null;
  }
}

export function setSession(res: NextResponse, username: string, secure: boolean) {
  res.cookies.set(COOKIE, makeToken(username), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: MAX_AGE });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function currentUser(): Promise<Me | null> {
  const name = readToken((await cookies()).get(COOKIE)?.value);
  if (!name) return null;
  await ensureSchema();
  const rows = await sql<Me[]>`select username, display_name, role, email from confirm_users where username = ${name} and active`;
  return rows[0] ?? null;
}

export function canDecide(me: Me, kind: string): boolean {
  const k = KINDS[kind as Kind];
  return !!k && (k.roles as readonly string[]).includes(me.role);
}

/**
 * 이 건을 볼 수 있나 — 역할 + (볼 사람을 정한 건이면) 그 명단.
 * 시험 건(source_key 'test:')은 명단에 있으면 역할과 상관없이 본다 — 3080 에 반영되지 않으므로
 * 다른 결재자 역할의 화면을 직접 점검할 수 있게.
 */
export function canSee(me: Me, r: { kind: string; visible_to?: string[] | null; source_key?: string }): boolean {
  const only = r.visible_to ?? [];
  if (only.length && (r.source_key ?? "").startsWith("test:")) return only.includes(me.username);
  return canDecide(me, r.kind) && (only.length === 0 || only.includes(me.username));
}

export const err = (status: number, error: string) => NextResponse.json({ error }, { status });

/** 동기화 API — 3080 만 쓰는 열쇠(Bearer). */
export function syncAuthorized(req: Request): boolean {
  const want = process.env.SYNC_TOKEN ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
