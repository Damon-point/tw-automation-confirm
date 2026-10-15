import { NextResponse } from "next/server";
import { err, syncAuthorized } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

const MIMES = new Set(["application/pdf", "text/html; charset=utf-8",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // License 검수의 PO — 3080 이 받는 형식 그대로
  "image/png", "image/jpeg", "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]);

/** 3080 → 검수 웹. 문서 하나 — base64 본문이 Vercel 함수 본문 한도(4.5MB) 안에 들도록 원본 3.3MB 까지. 같은 이름이면 바꿔 넣는다. */
export async function POST(req: Request) {
  if (!syncAuthorized(req)) return err(401, "열쇠가 맞지 않습니다");
  const f = (await req.json()) as { review_id: string; name: string; label?: string; mime: string; b64: string };
  if (!MIMES.has(f.mime)) return err(400, "받지 않는 문서 형식입니다");
  const data = Buffer.from(f.b64 ?? "", "base64");
  if (!data.length || data.length > 3_300_000) return err(400, "문서가 비었거나 너무 큽니다");
  const [r] = await sql`select id from confirm_reviews where id = ${f.review_id}`;
  if (!r) return err(404, "검수 건이 없습니다");
  await sql`
    insert into confirm_files (review_id, name, label, mime, size, data)
    values (${f.review_id}, ${f.name}, ${f.label ?? ""}, ${f.mime}, ${data.length}, ${data})
    on conflict (review_id, name) do update set label = excluded.label, mime = excluded.mime, size = excluded.size, data = excluded.data, updated_at = now()`;
  return NextResponse.json({ ok: true, size: data.length });
}
