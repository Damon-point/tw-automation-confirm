import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/db";

export const runtime = "nodejs";

/** 3080 ← 검수 웹. 웹에서 내려졌고 아직 3080 이 처리하지 않은 결정. */
export async function GET(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  await ensureSchema();
  const rows = await sql`
    select id, source_key, job_id, kind, status, decided_by, decided_at, note
      from confirm_reviews where status in ('approved', 'rejected') and process_state = 'waiting'
     order by decided_at`;
  return NextResponse.json({ decisions: rows });
}
