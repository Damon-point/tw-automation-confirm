import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 3080 → 검수 웹. 선별표 저장을 반영한 결과. 새 선별표 · 문서는 이어지는 push · file 로 올라온다.
 * echo=true(시험 건) — 3080 반영 없이 저장한 내용을 그대로 화면의 선별표로 삼는다.
 */
export async function POST(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  const a = (await req.json()) as { id: string; ok: boolean; message?: string; echo?: boolean };
  const msg = (a.message ?? "").slice(0, 2000);
  const [e] = await sql`
    update confirm_edits set state = ${a.ok ? "done" : "error"}, message = ${msg}, processed_at = now()
     where id = ${a.id} returning review_id, rows, inputs`;
  if (!e) return err(404, "저장 건이 없습니다");
  if (a.ok && a.echo) {
    const [r] = await sql`select summary from confirm_reviews where id = ${e.review_id}`;
    const sel = (r?.summary?.selection ?? {}) as { inputs?: { fields?: { key: string; label: string; value: string }[] } };
    const vals = new Map(((e.inputs ?? []) as { key: string; value: string }[]).map((f) => [f.key, f.value]));
    const fields = (sel.inputs?.fields ?? []).map((f) => (vals.has(f.key) ? { ...f, value: vals.get(f.key) } : f));
    const next = { ...sel, rows: e.rows, inputs: { ...(sel.inputs ?? {}), fields }, edited_at: new Date().toISOString() };
    await sql`update confirm_reviews set summary = jsonb_set(summary, '{selection}', ${sql.json(next as never)}), updated_at = now()
               where id = ${e.review_id}`;
  }
  await sql`insert into confirm_events (review_id, who, what) values (${e.review_id}, '3080', ${(a.ok ? "선별표 반영" : "선별표 반영 실패") + (msg ? ": " + msg : "")})`;
  return NextResponse.json({ ok: true });
}
