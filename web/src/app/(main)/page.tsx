"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { KIND_TONE, ReviewState, when } from "@/components/ReviewBits";
import { Empty, Skeleton, cx } from "@/components/ui";
import { ago, KIND_LABEL, useApi, type ReviewRow } from "@/lib/api";

type List = { reviews: ReviewRow[]; counts: { open: number; done: number } };
type KindFilter = "all" | ReviewRow["kind"];

const COLS_OPEN = "lg:grid-cols-[150px_minmax(0,1fr)_200px_130px_200px_20px]";
const COLS_DONE = "lg:grid-cols-[150px_minmax(0,1fr)_200px_minmax(0,0.8fr)_200px_20px]";

/** 검수 목록 — 결정 대기는 오래된 요청부터, 처리 완료는 최근 결정부터. 상세와 같은 폭 · 같은 표 모양. */
export default function Home() {
  const [scope, setScope] = useState<"open" | "done">("open");
  const [kind, setKind] = useState<KindFilter>("all");
  const [q, setQ] = useState("");
  const { data, loading, error } = useApi<List>(`/api/reviews?scope=${scope}`, 30_000);

  const rows = useMemo(() => data?.reviews ?? [], [data]);
  const byKind = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.kind] = (m[r.kind] ?? 0) + 1; });
    return m;
  }, [rows]);
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => (kind === "all" || r.kind === kind) &&
      (!ql || `${r.product} ${r.version} ${r.requested_by} ${r.decided_by} ${r.note}`.toLowerCase().includes(ql)));
  }, [rows, kind, q]);
  const kinds = (Object.keys(KIND_LABEL) as ReviewRow["kind"][]).filter((k) => byKind[k]);
  const open = scope === "open";
  const cols = open ? COLS_OPEN : COLS_DONE;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[22px] font-bold tracking-tight">검수</h1>
        <span className="text-[13px] text-ink-3">승인하면 3080 이 PDF 확정 · 파일서버 저장 · 결과 메일까지 처리합니다</span>
      </div>

      <section className="rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {([["open", "결정 대기", data?.counts.open], ["done", "처리 완료", data?.counts.done]] as const).map(([k, label, n]) => (
              <button key={k} onClick={() => { setScope(k); setKind("all"); }}
                      className={cx("rounded-md px-3.5 py-1.5 text-[13.5px] font-bold", scope === k ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>
                {label}{typeof n === "number" && <span className={cx("ml-1 text-[12px]", scope === k ? "text-white/80" : "text-ink-3")}>{n}</span>}
              </button>
            ))}
          </div>
          {kinds.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {(["all", ...kinds] as KindFilter[]).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                        className={cx("rounded-lg px-2.5 py-1.5 text-[13px] font-semibold",
                          kind === k ? "bg-surface-2 text-ink ring-1 ring-line-strong" : "text-ink-2 hover:bg-surface-2")}>
                  {k === "all" ? "전체" : KIND_LABEL[k].label}
                  <span className="ml-1 text-[12px] text-ink-3">{k === "all" ? rows.length : byKind[k]}</span>
                </button>
              ))}
            </div>
          )}
          <span className="flex-1" />
          <div className="relative w-full sm:w-[260px]">
            <Icon name="search" className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제품 · 버전 · 요청자"
                   className="w-full rounded-lg border border-line-strong bg-surface py-1.5 pl-8 pr-3 text-[13.5px] outline-none focus:border-brand" />
          </div>
        </header>

        {error && <div className="border-b border-line bg-err-soft px-4 py-2 text-[13px] text-err">{error}</div>}

        <div className={cx("hidden gap-3 border-b border-line px-4 py-2 text-[12px] font-bold text-ink-3 lg:grid", cols)}>
          <span>종류</span><span>제품 · 버전</span>
          {open ? <><span>요청</span><span>기다린 시간</span></> : <><span>결정</span><span>의견</span></>}
          <span>상태</span><span />
        </div>

        {loading && !data ? <div className="p-4"><Skeleton rows={4} /></div> : shown.length ? shown.map((r) => (
          <Link key={r.id} href={`/reviews/${r.id}`}
                className={cx("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-2", cols)}>
            <span className="flex items-center gap-1.5">
              <span className={cx("whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] font-bold", KIND_TONE[r.kind])}>{KIND_LABEL[r.kind]?.label}</span>
              {r.is_test && <span className="rounded-md bg-muted-soft px-1.5 py-0.5 text-[11.5px] font-bold text-ink-2">시험</span>}
            </span>
            <span className="justify-self-end lg:hidden"><ReviewState r={r} /></span>
            <span className="col-span-2 min-w-0 lg:col-span-1">
              <span className="block truncate text-[15px] font-bold">{r.product} {r.version}</span>
              <span className="block truncate text-[12.5px] text-ink-3">{KIND_LABEL[r.kind]?.target}{r.job_id ? ` · 작업 #${r.job_id}` : ""}</span>
            </span>
            {open ? (
              <>
                <span className="col-span-2 text-[13px] text-ink-2 lg:col-span-1">
                  {r.requested_by}<span className="ml-1.5 text-ink-3 lg:ml-0 lg:block lg:text-[12px]">{when(r.requested_at)}<span className="lg:hidden"> · {ago(r.requested_at)}</span></span>
                </span>
                <span className="hidden text-[13px] font-semibold text-ink-2 lg:block">{ago(r.requested_at) || "—"}</span>
              </>
            ) : (
              <>
                <span className="col-span-2 text-[13px] text-ink-2 lg:col-span-1">
                  {r.decided_by || "—"}<span className="ml-1.5 text-ink-3 lg:ml-0 lg:block lg:text-[12px]">{when(r.decided_at)}</span>
                </span>
                <span className="col-span-2 truncate text-[13px] text-ink-2 lg:col-span-1">{r.note || r.process_message || "—"}</span>
              </>
            )}
            <span className="hidden lg:block"><ReviewState r={r} /></span>
            <Icon name="chevron" className="hidden h-4 w-4 text-ink-3 lg:block" />
          </Link>
        )) : <Empty>{rows.length ? "조건에 맞는 검수가 없습니다" : open ? "결정을 기다리는 검수가 없습니다" : "처리한 검수가 없습니다"}</Empty>}
      </section>
    </>
  );
}
