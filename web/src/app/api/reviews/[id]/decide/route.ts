import { NextResponse } from "next/server";
import { canSee, currentUser, err } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 승인 · 반려 — 결정은 여기 남고, 3080 이 30초 안에 가져가 실제 처리(PDF 확정 · 파일서버 저장 · 결과 메일)를 한다.
 * 결정 대기(pending)인 건만 바꾼다 — 3080 에서 먼저 결정됐거나 다른 사람이 먼저 누르면 거절된다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const id = Number((await ctx.params).id);
  const { approve, note = "" } = (await req.json().catch(() => ({}))) as { approve?: boolean; note?: string };
  if (typeof approve !== "boolean") return err(400, "승인 또는 반려를 고르세요");
  const memo = note.trim().slice(0, 2000);
  if (!approve && !memo) return err(400, "반려 사유를 적으세요");

  const [r] = await sql`select kind, status, visible_to, source_key from confirm_reviews where id = ${id}`;
  if (!r || !canSee(me, r as unknown as { kind: string; visible_to: string[]; source_key: string })) return err(404, "검수 건이 없습니다");
  const [busy] = await sql`select 1 from confirm_edits where review_id = ${id} and state = 'waiting' limit 1`;
  if (busy) return err(409, "선별표 저장을 3080 이 반영하는 중입니다 — 새 문서가 올라온 뒤 결정하세요");
  const done = await sql`
    update confirm_reviews
       set status = ${approve ? "approved" : "rejected"}, decided_by = ${me.username}, decided_at = now(), decided_via = 'web',
           note = ${memo}, process_state = 'waiting', process_message = '', updated_at = now()
     where id = ${id} and status = 'pending'
    returning id`;
  if (!done.length) return err(409, "이미 결정된 건입니다");
  await sql`insert into confirm_events (review_id, who, what) values (${id}, ${me.username}, ${approve ? "승인" : "반려: " + memo})`;
  return NextResponse.json({ ok: true, message: approve ? "승인했습니다 — 3080 이 곧 처리합니다" : "반려했습니다 — 요청자에게 전달됩니다" });
}
