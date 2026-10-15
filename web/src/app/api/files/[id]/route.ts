import { canSee, currentUser, err } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/** 검수 문서 — 로그인한 결재자 중 그 종류를 결정할 수 있는 사람만. 뉴스레터 HTML 은 화면에서 sandbox iframe 으로만 연다. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  const id = Number((await ctx.params).id);
  const [f] = await sql<{ name: string; mime: string; data: Buffer; kind: string; visible_to: string[]; source_key: string }[]>`
    select f.name, f.mime, f.data, r.kind, r.visible_to, r.source_key from confirm_files f join confirm_reviews r on r.id = f.review_id where f.id = ${id}`;
  if (!f || !canSee(me, f)) return err(404, "문서가 없습니다");
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // HTML 문서가 이 앱의 쿠키 · API 에 손대지 못하게
      ...(f.mime.startsWith("text/html") ? { "Content-Security-Policy": "sandbox; default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src * data:" } : {}),
    },
  });
}
