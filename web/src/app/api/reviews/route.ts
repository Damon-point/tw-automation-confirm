import { NextResponse } from "next/server";
import { canDecide, currentUser, err } from "@/lib/auth";
import { KINDS, sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 검수 목록 — open(결정 대기) · done(결정됨 · 닫힘).
 * 결재자는 자기가 결정할 수 있는 종류만, 볼 사람을 정한 건은 그 명단만. 시험 건은 명단에 있으면 역할과 상관없이.
 */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const scope = new URL(req.url).searchParams.get("scope") === "done" ? "done" : "open";
  const kinds = (Object.keys(KINDS) as (keyof typeof KINDS)[]).filter((k) => canDecide(me, k));
  const mine = sql`(
      (${kinds.length ? sql`kind in ${sql(kinds)}` : sql`false`} and (cardinality(visible_to) = 0 or ${me.username} = any(visible_to)))
      or (source_key like 'test:%' and ${me.username} = any(visible_to)))`;
  const rows = await sql`
    select id, job_id, kind, product, version, requested_by, requested_at, status, decided_by, decided_at, decided_via,
           note, process_state, process_message, processed_at, source_key like 'test:%' as is_test,
           (select count(*)::int from confirm_files f where f.review_id = r.id) as files
    from confirm_reviews r
    where ${mine}
      and ${scope === "open" ? sql`status = 'pending'` : sql`status <> 'pending'`}
    order by ${scope === "open" ? sql`requested_at asc nulls last` : sql`coalesce(decided_at, updated_at) desc`}
    limit 200`;
  const [c] = await sql<{ open: number; done: number }[]>`
    select count(*) filter (where status = 'pending')::int as open, count(*) filter (where status <> 'pending')::int as done
    from confirm_reviews where ${mine}`;
  return NextResponse.json({ reviews: rows, counts: c });
}
