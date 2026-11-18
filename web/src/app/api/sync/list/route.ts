import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 3080 ← 검수 웹. 결재 키 앞부분으로 결재 건 목록 — 지우기 전에 무엇이 있는지 보려고(2026-11-18, 시험 건 정리).
 * prefix 는 필수다(전체 목록은 주지 않는다). 문서 본문은 싣지 않는다.
 */
export async function GET(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  const prefix = new URL(req.url).searchParams.get("prefix") ?? "";
  if (prefix.length < 3) return err(400, "키 앞부분(prefix)을 3자 이상 정하세요");
  await ensureSchema();
  const like = prefix.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const rows = await sql`
    select r.id, r.source_key, r.job_id, r.kind, r.product, r.version, r.status, r.requested_by, r.created_at,
           (select count(*)::int from confirm_files f where f.review_id = r.id) as files
      from confirm_reviews r where r.source_key like ${like}
     order by r.created_at`;
  return NextResponse.json({ reviews: rows });
}
