import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 3080 → 검수 웹. 웹 결정을 처리한 결과.
 *  ok=true  — 처리 완료(PDF 확정 · 저장 · 결과 메일)
 *  ok=false — 처리 실패. 3080 은 아직 '요청됨' 그대로이므로 결정 대기로 되돌려 다시 결정할 수 있게 한다.
 *  superseded=true — 3080 에서 이미 다른 결정이 있었던 것이라 웹 결정을 무르고 닫는다.
 */
export async function POST(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  const a = (await req.json()) as { id: string; ok: boolean; message?: string; superseded?: boolean };
  const msg = (a.message ?? "").slice(0, 2000);
  const rows = a.superseded
    ? await sql`update confirm_reviews set status = 'closed', process_state = 'done', process_message = ${msg},
                  processed_at = now(), updated_at = now() where id = ${a.id} returning id`
    : a.ok
    ? await sql`update confirm_reviews set process_state = 'done', process_message = ${msg},
                  processed_at = now(), updated_at = now() where id = ${a.id} returning id`
    : await sql`update confirm_reviews set status = 'pending', decided_by = '', decided_at = null, decided_via = '',
                  process_state = 'error', process_message = ${msg}, processed_at = now(), updated_at = now()
                 where id = ${a.id} returning id`;
  if (!rows.length) return err(404, "검수 건이 없습니다");
  await sql`insert into confirm_events (review_id, who, what) values (${a.id}, '3080', ${(a.ok ? "처리 완료" : a.superseded ? "3080 에서 먼저 처리됨" : "처리 실패 — 결정 대기로 되돌림") + (msg ? ": " + msg : "")})`;
  return NextResponse.json({ ok: true });
}
