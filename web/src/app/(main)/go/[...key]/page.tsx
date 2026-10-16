"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

/** 메일의 바로가기 — /go/license/{doc_id} 를 그 검수 화면으로. 신청 직후라 아직 안 올라왔으면 잠시 기다린다. */
export default function Go({ params }: { params: Promise<{ key: string[] }> }) {
  const { key } = use(params);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const source = key.map(decodeURIComponent).join(":");

  useEffect(() => {
    let alive = true;
    let tries = 0;
    async function look() {
      try {
        const r = await api<{ id: string }>(`/api/reviews/by-key?key=${encodeURIComponent(source)}`);
        if (alive) router.replace(`/reviews/${r.id}`);
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404 && tries++ < 24) {
          setMsg("검수 웹에 올라오는 중입니다 — 인증서를 만드는 데 잠시 걸립니다");
          setTimeout(look, 5000);
        } else {
          setMsg(e instanceof Error ? e.message : "열 수 없습니다");
        }
      }
    }
    look();
    return () => { alive = false; };
  }, [source, router]);

  return (
    <div className="mx-auto max-w-[640px]">
      {msg ? <div className="rounded-2xl border border-line bg-surface px-5 py-6 text-center text-[14px] text-ink-2">{msg}</div> : <Skeleton rows={3} />}
    </div>
  );
}
