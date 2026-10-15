import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 3080 → 검수 웹. 결재 건을 지운다(문서 · 기록 함께) — 3080 에서 작업을 지웠거나 잘못 올라간 건.
 * job_ids 는 그 작업의 모든 건, source_keys 는 그 건만. 지운 건의 source_key 를 돌려준다.
 */
export async function POST(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  const b = (await req.json().catch(() => ({}))) as { job_ids?: number[]; source_keys?: string[] };
  const jobs = (b.job_ids ?? []).map(Number).filter((n) => Number.isInteger(n));
  const keys = (b.source_keys ?? []).filter((k) => typeof k === "string" && k);
  if (!jobs.length && !keys.length) return err(400, "지울 건을 정하세요");
  const gone = await sql<{ source_key: string }[]>`
    delete from confirm_reviews
     where ${jobs.length ? sql`job_id in ${sql(jobs)}` : sql`false`}
        or ${keys.length ? sql`source_key in ${sql(keys)}` : sql`false`}
    returning source_key`;
  return NextResponse.json({ ok: true, removed: gone.map((g) => g.source_key) });
}
