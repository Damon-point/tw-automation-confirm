import { NextResponse } from "next/server";
import { canDecide, currentUser, err } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const id = Number((await ctx.params).id);
  const [r] = await sql`select * from confirm_reviews where id = ${id}`;
  if (!r || !canDecide(me, r.kind)) return err(404, "검수 건이 없습니다");
  const files = await sql`select id, name, label, mime, size from confirm_files where review_id = ${id} order by id`;
  const events = await sql`select at, who, what from confirm_events where review_id = ${id} order by at`;
  return NextResponse.json({ ...r, files, events, can_decide: r.status === "pending" });
}
