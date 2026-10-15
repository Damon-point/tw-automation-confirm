"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { ReviewState, when } from "@/components/ReviewBits";
import { Empty, Skeleton, cx } from "@/components/ui";
import { ago, KIND_LABEL, useApi, type ReviewRow } from "@/lib/api";

type List = { reviews: ReviewRow[]; counts: { open: number; done: number } };

/** 검수 목록 — 결정 대기가 먼저(오래된 요청부터), 처리 완료는 최근 결정부터. */
export default function Home() {
  const [scope, setScope] = useState<"open" | "done">("open");
  const { data, loading, error } = useApi<List>(`/api/reviews?scope=${scope}`, 30_000);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">검수</h1>
          <p className="mt-1 text-[13px] text-ink-2">문서를 열어 확인하고 승인 · 반려합니다. 승인하면 3080 이 PDF 확정 · 파일서버 저장 · 결과 메일까지 처리합니다.</p>
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5 text-[13px] font-semibold">
          {([["open", "결정 대기", data?.counts.open], ["done", "처리 완료", data?.counts.done]] as const).map(([k, label, n]) => (
            <button key={k} onClick={() => setScope(k)}
                    className={cx("rounded-md px-3.5 py-1.5", scope === k ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>
              {label}{typeof n === "number" && <span className={cx("ml-1", scope === k ? "text-white/80" : "text-ink-3")}>{n}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-err-soft px-3 py-2 text-[13px] text-err">{error}</div>}
      {loading && !data ? <Skeleton rows={4} /> : data?.reviews.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {data.reviews.map((r) => (
            <Link key={r.id} href={`/reviews/${r.id}`}
                  className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-surface-2">
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                r.kind === "newsletter" ? "bg-info-soft text-info" : "bg-brand-soft text-brand-ink")}>
                <Icon name={r.kind === "newsletter" ? "mail" : "file"} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[15px] font-bold">{r.product} {r.version}</span>
                  <span className="text-[12.5px] text-ink-3">{KIND_LABEL[r.kind]?.label}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                  {scope === "open"
                    ? <>요청 {r.requested_by} · {ago(r.requested_at) || when(r.requested_at)}</>
                    : <>{r.decided_by || "-"} · {when(r.decided_at)}{r.note ? ` · ${r.note}` : ""}</>}
                </span>
              </span>
              <ReviewState r={r} />
              <Icon name="chevron" className="h-4 w-4 shrink-0 text-ink-3" />
            </Link>
          ))}
        </div>
      ) : <Empty>{scope === "open" ? "결정을 기다리는 검수가 없습니다" : "처리한 검수가 없습니다"}</Empty>}
    </>
  );
}
