import { NextResponse } from "next/server";
import { currentUser, err } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const me = await currentUser();
  if (!me) return err(401, "로그인이 필요합니다");
  return NextResponse.json(me);
}
