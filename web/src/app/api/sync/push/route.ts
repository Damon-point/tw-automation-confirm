import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { ensureSchema, KINDS, sql } from "@/lib/db";

export const runtime = "nodejs";

type UserIn = { username: string; display_name?: string; email?: string; role: string; password_hash: string };
type ReviewIn = {
  source_key: string; job_id: number; kind: string; product?: string; version?: string;
  requested_by?: string; requested_at?: string; summary?: Record<string, unknown>; visible_to?: string[];
};
/** 날짜로 읽히지 않는 값은 비운다(3080 상태 파일의 손 고친 값 등). */
function ts(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

type ClosedIn = { source_key: string; status: string; decided_by?: string; decided_at?: string; note?: string };

/**
 * 3080 → 검수 웹. 결재자 계정 · 새 승인 요청 · 3080 에서 먼저 닫힌 요청을 올린다.
 * 돌려주는 것: 요청마다 웹 id 와 이미 받은 문서 이름 — 3080 은 없는 문서만 /api/sync/file 로 올린다.
 */
export async function POST(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  await ensureSchema();
  const body = (await req.json()) as { users?: UserIn[]; reviews?: ReviewIn[]; closed?: ClosedIn[] };

  if (Array.isArray(body.users)) {
    const users = body.users.filter((u) => u.username && u.password_hash && u.role);
    for (const u of users) {
      await sql`
        insert into confirm_users (username, display_name, email, role, password_hash, active, synced_at)
        values (${u.username}, ${u.display_name ?? ""}, ${u.email ?? ""}, ${u.role}, ${u.password_hash}, true, now())
        on conflict (username) do update set display_name = excluded.display_name, email = excluded.email, role = excluded.role,
          password_hash = excluded.password_hash, active = true, synced_at = now()`;
    }
    // 3080 에서 결재자가 아니게 된 계정은 막는다
    const names = users.map((u) => u.username);
    if (names.length) await sql`update confirm_users set active = false where username not in ${sql(names)}`;
    else await sql`update confirm_users set active = false`;
  }

  const out: Record<string, { id: string; status: string; files: string[] }> = {};
  for (const r of body.reviews ?? []) {
    if (!r.source_key || !(r.kind in KINDS)) continue;
    await sql`
      insert into confirm_reviews (source_key, job_id, kind, product, version, requested_by, requested_at, summary, visible_to)
      values (${r.source_key}, ${r.job_id}, ${r.kind}, ${r.product ?? ""}, ${r.version ?? ""}, ${r.requested_by ?? ""},
              ${ts(r.requested_at)}, ${sql.json((r.summary ?? {}) as never)}, ${(r.visible_to ?? []).filter(Boolean)})
      on conflict (source_key) do update set summary = excluded.summary, visible_to = excluded.visible_to, updated_at = now()`;
    const [row] = await sql<{ id: string; status: string }[]>`select id, status from confirm_reviews where source_key = ${r.source_key}`;
    const files = await sql<{ name: string }[]>`select name from confirm_files where review_id = ${row.id}`;
    out[r.source_key] = { id: String(row.id), status: row.status, files: files.map((f) => f.name) };
  }

  let closed = 0;
  for (const c of body.closed ?? []) {
    const done = await sql`
      update confirm_reviews
         set status = 'closed', decided_by = ${c.decided_by ?? ""}, decided_at = ${ts(c.decided_at)}, decided_via = '3080',
             note = ${c.note ?? ""}, process_state = 'done',
             process_message = ${c.status === "approved" ? "3080 에서 승인됨" : c.status === "rejected" ? "3080 에서 반려됨" : "3080 에서 요청이 취소됨"},
             processed_at = now(), updated_at = now()
       where source_key = ${c.source_key} and status = 'pending'
      returning id`;
    if (done.length) {
      closed++;
      await sql`insert into confirm_events (review_id, who, what) values (${done[0].id}, ${c.decided_by ?? "3080"}, ${"3080 에서 처리: " + c.status})`;
    }
  }
  return NextResponse.json({ ok: true, reviews: out, closed });
}
