"use client";

import { cx } from "./ui";
import type { ReviewRow } from "@/lib/api";

/** 상태 칩 — 결정 대기 · 승인(처리 중/완료/실패) · 반려 · 3080 에서 처리됨 */
export function ReviewState({ r }: { r: Pick<ReviewRow, "status" | "process_state" | "decided_via"> }) {
  const [label, cls] = (() => {
    if (r.status === "pending") return [r.process_state === "error" ? "결정 대기 · 이전 처리 실패" : "결정 대기", "bg-warn-soft text-warn"];
    if (r.status === "closed") return ["3080 에서 처리됨", "bg-muted-soft text-ink-2"];
    const verb = r.status === "approved" ? "승인" : "반려";
    if (r.process_state === "waiting") return [`${verb} · 3080 처리 대기`, "bg-info-soft text-info"];
    if (r.process_state === "error") return [`${verb} · 처리 실패`, "bg-err-soft text-err"];
    return [verb, r.status === "approved" ? "bg-ok-soft text-ok" : "bg-err-soft text-err"];
  })();
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold", cls)}>{label}</span>;
}

export function when(iso: string | null | undefined) {
  if (!iso) return "";
  const t = new Date(iso);
  if (isNaN(t.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
