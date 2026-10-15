import { NextResponse } from "next/server";
import { canSee, currentUser, err } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const id = Number((await ctx.params).id);
  const [r] = await sql`select * from confirm_reviews where id = ${id}`;
  if (!r || !canSee(me, r as unknown as { kind: string; visible_to: string[] })) return err(404, "검수 건이 없습니다");
  const files = await sql`select id, name, label, mime, size, updated_at from confirm_files where review_id = ${id} order by id`;
  const events = await sql`select at, who, what from confirm_events where review_id = ${id} order by at`;
  const [edit] = await sql`select id, by_user, at, state, message from confirm_edits where review_id = ${id} order by id desc limit 1`;
  const row = { ...r };
  delete row.visible_to;
  return NextResponse.json({ ...row, files, events, edit: edit ?? null, can_decide: r.status === "pending" });
}
