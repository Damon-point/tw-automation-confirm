"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import SelectionEditor from "@/components/SelectionEditor";
import { Icon } from "@/components/Icons";
import { ReviewState, when } from "@/components/ReviewBits";
import { Empty, Skeleton, cx } from "@/components/ui";
import { api, KIND_LABEL, useApi, type ReviewDetail, type ReviewFile } from "@/lib/api";

function kb(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** 문서 보기 — PDF 는 브라우저 뷰어, 뉴스레터 HTML 은 스크립트를 막은 iframe. 넓은 화면에서는 오른쪽에 붙어 있다. */
function Viewer({ files, tall }: { files: ReviewFile[]; tall?: boolean }) {
  const [sel, setSel] = useState(files[0]?.id);
  const f = files.find((x) => x.id === sel) ?? files[0];
  if (!f) return <Empty>올라온 문서가 없습니다</Empty>;
  const src = `/api/files/${f.id}`;
  const html = f.mime.startsWith("text/html");
  const viewable = html || f.mime === "application/pdf";
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
        {files.length > 1 ? files.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)}
                  className={cx("rounded-lg px-2.5 py-1 text-[13px] font-semibold",
                    x.id === f.id ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2")}>
            {x.label || x.name}
          </button>
        )) : <span className="truncate px-1 text-[13.5px] font-bold">{f.label || f.name}</span>}
        <span className="flex-1" />
        <a href={src} target="_blank" rel="noreferrer" title="새 창" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2">
          <Icon name="eye" /> 새 창
        </a>
        <a href={`${src}?download=1`} title="받기" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2">
          <Icon name="file" /> {kb(f.size)}
        </a>
      </header>
      {viewable ? (
        <iframe key={`${f.id}-${f.updated_at}`} src={`${src}?v=${encodeURIComponent(f.updated_at ?? "")}${html ? "" : "#navpanes=0&view=FitH"}`} title={f.label || f.name}
                sandbox={html ? "" : undefined}
                className={cx("w-full flex-1", tall ? "min-h-[480px]" : "h-[75vh] min-h-[480px]", html ? "bg-white" : "bg-surface-2")} />
      ) : (
        <div className="px-4 py-10 text-center text-[13px] text-ink-2">{f.name} — 받아서 엽니다</div>
      )}
    </section>
  );
}

/** 결정 막대 — 위에 붙어 있어 어디까지 내려가도 바로 승인 · 반려할 수 있다. */
function DecideBar({ r, onDone, blocked }: { r: ReviewDetail; onDone: () => void; blocked: string }) {
  const [reject, setReject] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function decide(approve: boolean) {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/reviews/${r.id}/decide`, { method: "POST", body: JSON.stringify({ approve, note: note.trim() }) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리하지 못했습니다");
    } finally {
      setBusy(false);
      onDone();
    }
  }

  const prevErr = r.process_state === "error" && r.process_message ? `이전 결정을 3080 이 처리하지 못했습니다 — ${r.process_message}` : "";
  const msg = err || blocked || prevErr;
  return (
    <div className={cx("rounded-2xl border bg-surface px-3 py-2.5 shadow-[0_4px_16px_rgba(16,24,40,.08)]", reject ? "border-err/40" : "border-line")}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
               placeholder={reject ? "반려 사유 (필수)" : "의견 (선택)"}
               className={cx("min-w-0 flex-1 rounded-lg border bg-surface px-3 py-2 text-[14px] outline-none focus:ring-2",
                 reject ? "border-err/50 focus:ring-err/20" : "border-line-strong focus:border-brand focus:ring-brand/20")} />
        <div className="flex gap-2">
          {reject ? (
            <>
              <button disabled={busy || !!blocked || !note.trim()} onClick={() => decide(false)}
                      className="flex-1 rounded-lg bg-err px-5 py-2 text-[14px] font-bold text-white disabled:opacity-40 md:flex-none">
                {busy ? "처리 중…" : "반려하기"}
              </button>
              <button disabled={busy} onClick={() => setReject(false)}
                      className="rounded-lg border border-line px-4 py-2 text-[14px] font-semibold text-ink-2 hover:bg-surface-2">취소</button>
            </>
          ) : (
            <>
              <button disabled={busy || !!blocked} onClick={() => decide(true)}
                      className="flex-1 rounded-lg bg-brand px-6 py-2 text-[14px] font-bold text-white hover:bg-brand-ink disabled:opacity-40 md:flex-none">
                {busy ? "처리 중…" : "승인"}
              </button>
              <button disabled={busy || !!blocked} onClick={() => setReject(true)}
                      className="rounded-lg border border-err/40 px-4 py-2 text-[14px] font-semibold text-err hover:bg-err-soft disabled:opacity-40">반려</button>
            </>
          )}
        </div>
      </div>
      {msg && <div className={cx("mt-2 rounded-lg px-3 py-1.5 text-[13px]", err || prevErr ? "bg-err-soft text-err" : "bg-warn-soft text-warn")}>{msg}</div>}
    </div>
  );
}

function Outcome({ r }: { r: ReviewDetail }) {
  const tone = r.process_state === "error" ? "bg-err-soft text-err"
    : r.process_state === "waiting" ? "bg-info-soft text-info"
    : r.status === "approved" ? "bg-ok-soft text-ok"
    : r.status === "rejected" ? "bg-err-soft text-err" : "bg-muted-soft text-ink-2";
  const head = r.status === "closed" ? (r.process_message || "3080 에서 처리됨")
    : `${r.decided_by} 님이 ${r.status === "approved" ? "승인" : "반려"} · ${when(r.decided_at)}`;
  const tail = r.status === "closed" ? "" : r.process_state === "waiting" ? "3080 이 이어서 처리하는 중" : r.process_message;
  return (
    <div className={cx("rounded-2xl px-4 py-3 text-[13.5px]", tone)}>
      <span className="font-semibold">{head}</span>
      {r.note && <span className="ml-2 whitespace-pre-wrap opacity-90">— {r.note}</span>}
      {tail && <span className="ml-2 opacity-90">· {tail}</span>}
    </div>
  );
}

function History({ events }: { events: ReviewDetail["events"] }) {
  if (!events.length) return null;
  return (
    <details className="mt-5 rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-bold">처리 기록 <span className="font-normal text-ink-3">{events.length}</span></summary>
      <ol className="space-y-2 border-t border-line px-4 py-3">
        {events.map((e, i) => (
          <li key={i} className="flex flex-wrap gap-x-3 text-[13px]">
            <span className="w-[130px] shrink-0 font-mono text-[12px] text-ink-3">{when(e.at)}</span>
            <span className="w-[160px] shrink-0 truncate text-ink-2">{e.who}</span>
            <span className="min-w-0 flex-1">{e.what}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // 결정 직후 · 선별표 반영 중에는 3080 결과를 자주 새로 읽는다
  const { data: r, error, loading, reload } = useApi<ReviewDetail>(`/api/reviews/${id}`,
    (d) => (d?.process_state === "waiting" || d?.edit?.state === "waiting" ? 5_000 : 30_000));
  const [dirty, setDirty] = useState(false);
  const onDirty = useCallback((d: boolean) => setDirty(d), []);
  useEffect(() => { if (r) document.title = `${r.product} ${r.version} · ${KIND_LABEL[r.kind]?.label ?? ""}`; }, [r]);

  if (loading && !r) return <Skeleton rows={6} />;
  if (!r) return <Empty>{error || "검수 건이 없습니다"}</Empty>;
  const kind = KIND_LABEL[r.kind];
  const sel = r.summary?.selection;
  const editWaiting = r.edit?.state === "waiting";
  const canEdit = !!sel?.editable && r.can_decide;
  const blocked = editWaiting ? "저장한 선별표로 3080 이 전체 이력 RN 을 다시 만드는 중입니다"
    : dirty ? "공개 선별표 · 입력값에 저장하지 않은 변경이 있습니다" : "";
  const revision = r.summary?.revision ?? [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-1">
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" /> 목록
        </Link>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-[22px] font-bold tracking-tight">{r.product} {r.version}</h1>
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12.5px] font-bold text-brand-ink">{kind?.label}</span>
        <ReviewState r={r} />
        <span className="text-[13px] text-ink-3">{kind?.target} · 요청 {r.requested_by} · {when(r.requested_at)}{r.job_id ? ` · 작업 #${r.job_id}` : ""}</span>
      </div>

      <div className="sticky top-14 z-20 -mx-1 mb-4 bg-bg/90 px-1 py-2 backdrop-blur">
        {r.can_decide ? <DecideBar r={r} onDone={reload} blocked={blocked} /> : <Outcome r={r} />}
        {r.edit && r.edit.state !== "done" && (
          <div className={cx("mt-2 rounded-xl px-4 py-2 text-[13px]", editWaiting ? "bg-info-soft text-info" : "bg-err-soft text-err")}>
            {editWaiting ? `${r.edit.by_user} 님이 저장한 선별표를 3080 이 반영하는 중 — 끝나면 문서가 새로 올라옵니다`
              : `선별표 반영 실패 — ${r.edit.message}`}
          </div>
        )}
      </div>

      {sel ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,1fr)]">
          <div className="min-w-0">
            <SelectionEditor reviewId={r.id} sel={sel} locked={!canEdit || editWaiting} onDirty={onDirty} onSaved={() => reload()}
                             doneMessage={r.edit?.state === "done" ? r.edit.message : ""} />
          </div>
          <div className="min-w-0 xl:sticky xl:top-[calc(3.5rem+5.5rem)] xl:h-[calc(100vh-3.5rem-6.5rem)]">
            <Viewer files={r.files} tall />
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0"><Viewer files={r.files} /></div>
          {revision.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface px-4 py-3">
              <h2 className="mb-2 text-[14px] font-bold">변경 내용</h2>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">{revision.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </section>
          )}
        </div>
      )}

      <History events={r.events} />
    </>
  );
}
