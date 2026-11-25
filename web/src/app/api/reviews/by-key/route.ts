import { NextResponse } from "next/server";
import { canSee, currentUser, err } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/** 메일 링크(/go/license/{doc_id} · /go/job-N/kind/요청시각) → 검수 건 id. 아직 올라오기 전이면 404(화면이 잠시 뒤 다시 묻는다). */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const key = new URL(req.url).searchParams.get("key") ?? "";
  // 머리는 'license' 도 'job-37' 도 있다 — 예전 검사([a-z]+)는 OS Update 결재 키(job-N:kind:시각)를 막았다(2026-11-25)
  if (!/^[a-z][\w\-]*:[\w.\-:]+$/.test(key)) return err(400, "잘못된 주소입니다");
  const [r] = await sql`select id, kind, visible_to, source_key from confirm_reviews where source_key = ${key}`;
  if (!r) return err(404, "아직 올라오지 않았습니다");
  if (!canSee(me, r as unknown as { kind: string; visible_to: string[]; source_key: string })) return err(403, "이 결재를 볼 권한이 없습니다");
  return NextResponse.json({ id: String(r.id) });
}
