import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";

export const runtime = "nodejs";

/** 3080 ← 검수 웹. 아직 반영하지 않은 선별표 · 입력값 저장. */
export async function GET(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  await ensureSchema();
  const edits = await sql`
    select e.id, r.source_key, e.by_user as by, e.rows, e.inputs
      from confirm_edits e join confirm_reviews r on r.id = e.review_id
     where e.state = 'waiting' order by e.id`;
  return NextResponse.json({ edits });
}
