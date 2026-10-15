"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login") && !location.pathname.startsWith("/signup")) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

/** 데이터를 가져오고, refreshMs 를 주면 그 간격으로 다시 가져온다(창이 보일 때만). */
export function useApi<T>(path: string | null, refreshMs?: number | ((d: T | null) => number | undefined)) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const dataRef = useRef<T | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      dataRef.current = d;
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const ms = typeof refreshMs === "function" ? refreshMs(dataRef.current) : refreshMs;
      if (!ms) return;
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await load();
        tick();
      }, ms);
    };
    tick();
    return () => clearTimeout(timer);
  }, [load, refreshMs]);

  return { data, error, loading, reload: load };
}

// ── 응답 타입 ────────────────────────────────────────────────────────────────

export type Tone = "ok" | "warn" | "error" | "none";
export type Summary = { tone: Tone; headline: string; errors: string[]; warnings: string[]; ok_count: number };
export type Me = { username: string; display_name: string; role: string; email: string };

export type ReviewStatus = "pending" | "approved" | "rejected" | "closed";
export type ReviewRow = {
  id: string; job_id: number; kind: "mid" | "final" | "newsletter"; product: string; version: string;
  requested_by: string; requested_at: string; status: ReviewStatus; decided_by: string; decided_at: string | null;
  decided_via: string; note: string; process_state: "" | "waiting" | "done" | "error"; process_message: string;
  processed_at: string | null; files: number;
};
export type ReviewFile = { id: string; name: string; label: string; mime: string; size: number; updated_at: string };

export type SelRow = {
  no: number | string; issue: string; team?: string; customer?: string; gubun?: string;
  include: "Y" | "X"; reason?: string; public?: string; redmine?: string; sensitive?: boolean;
  apply_note: string; exclude_note?: string; kind?: string; manual?: boolean;
};
/** 선별표의 입력 값 칸 — key 가 빈 것은 최초 릴리즈에서 새로 더한 항목 */
export type InputField = { key: string; label: string; required: boolean; value: string; manual: boolean; version: string };
export type Selection = {
  rows: SelRow[]; inputs: { fields: InputField[]; editable: boolean; now_version: string };
  exclude_notes: string[]; edited_at: string; edited_by: string; editable: boolean;
};
export type ReviewEdit = { id: string; by_user: string; at: string; state: "waiting" | "done" | "error"; message: string };

export type ReviewDetail = ReviewRow & {
  summary: { revision?: string[]; lines?: { label: string; value: string }[]; links?: { label: string; url: string }[]; selection?: Selection };
  files: ReviewFile[]; events: { at: string; who: string; what: string }[]; can_decide: boolean; edit: ReviewEdit | null;
};

export const KIND_LABEL: Record<string, { label: string; target: string }> = {
  mid: { label: "RN 승인 (1차)", target: "Release Note · 전체 이력" },
  final: { label: "최종 검수 (2차)", target: "Release Note for Sales" },
  newsletter: { label: "뉴스레터 결재", target: "Newsletter" },
};

export function ago(iso: string) {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (isNaN(t.getTime())) return iso;
  const s = (Date.now() - t.getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return `${t.getMonth() + 1}/${t.getDate()}`;
}
