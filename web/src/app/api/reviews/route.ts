import { NextResponse } from "next/server";
import { canDecide, currentUser, err } from "@/lib/auth";
import { KINDS, sql } from "@/lib/db";

export const runtime = "nodejs";

/** 검수 목록 — open(결정 대기) · done(결정됨 · 닫힘). 관리자는 모두, 결재자는 자기가 결정할 수 있는 종류만. */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const scope = new URL(req.url).searchParams.get("scope") === "done" ? "done" : "open";
  const kinds = (Object.keys(KINDS) as (keyof typeof KINDS)[]).filter((k) => canDecide(me, k));
  if (!kinds.length) return NextResponse.json({ reviews: [], counts: { open: 0, done: 0 } });
  const rows = await sql`
    select id, job_id, kind, product, version, requested_by, requested_at, status, decided_by, decided_at, decided_via,
           note, process_state, process_message, processed_at,
           (select count(*)::int from confirm_files f where f.review_id = r.id) as files
    from confirm_reviews r
    where kind in ${sql(kinds)}
      and (cardinality(visible_to) = 0 or ${me.username} = any(visible_to))
      and ${scope === "open" ? sql`status = 'pending'` : sql`status <> 'pending'`}
    order by ${scope === "open" ? sql`requested_at asc` : sql`coalesce(decided_at, updated_at) desc`}
    limit 200`;
  const [c] = await sql<{ open: number; done: number }[]>`
    select count(*) filter (where status = 'pending')::int as open, count(*) filter (where status <> 'pending')::int as done
    from confirm_reviews where kind in ${sql(kinds)} and (cardinality(visible_to) = 0 or ${me.username} = any(visible_to))`;
  return NextResponse.json({ reviews: rows, counts: c });
}
