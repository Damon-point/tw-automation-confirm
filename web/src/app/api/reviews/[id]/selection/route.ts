import { NextResponse } from "next/server";
import { canSee, currentUser, err } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

type Row = Record<string, unknown> & { no: number | string; include?: string; apply_note?: string; manual?: boolean };
type Input = { key: string; label: string; value: string };

/**
 * RN 승인(1차) 결재자의 공개 선별표 · 입력값 저장 — 3080 이 30초 안에 가져가 전체 이력 RN 을 다시 만든다.
 * 결정 대기인 1차 건만, 앞선 저장이 반영되기 전에는 다시 받지 않는다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const id = Number((await ctx.params).id);
  const [r] = await sql`select kind, status, visible_to from confirm_reviews where id = ${id}`;
  if (!r || !canSee(me, r as unknown as { kind: string; visible_to: string[] })) return err(404, "검수 건이 없습니다");
  if (r.kind !== "mid") return err(400, "RN 승인(1차)에서만 고칠 수 있습니다");
  if (r.status !== "pending") return err(409, "이미 결정된 건입니다");
  const b = (await req.json().catch(() => ({}))) as { rows?: Row[]; inputs?: Input[] };
  if (!Array.isArray(b.rows) || !b.rows.length) return err(400, "선별표가 비었습니다");
  const inputs = Array.isArray(b.inputs)
    ? b.inputs.map((f) => ({ key: String(f.key ?? ""), label: String(f.label ?? ""), value: String(f.value ?? "") }))
    : null;
  const [busy] = await sql`select 1 from confirm_edits where review_id = ${id} and state = 'waiting' limit 1`;
  if (busy) return err(409, "앞서 저장한 내용을 3080 이 반영하는 중입니다");
  await sql`insert into confirm_edits (review_id, by_user, rows, inputs)
            values (${id}, ${me.username}, ${sql.json(b.rows as never)}, ${inputs ? sql.json(inputs as never) : null})`;
  await sql`insert into confirm_events (review_id, who, what) values (${id}, ${me.username}, '공개 선별표 · 입력값 저장')`;
  return NextResponse.json({ ok: true, message: "저장했습니다 — 3080 이 전체 이력 RN 을 다시 만듭니다" });
}
