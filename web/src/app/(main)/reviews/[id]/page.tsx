"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import SelectionEditor from "@/components/SelectionEditor";
import { Icon } from "@/components/Icons";
import { ReviewState, when } from "@/components/ReviewBits";
import { Card, Empty, Skeleton, cx } from "@/components/ui";
import { api, KIND_LABEL, useApi, type ReviewDetail, type ReviewFile } from "@/lib/api";

function kb(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** 문서 보기 — PDF 는 브라우저 뷰어, 뉴스레터 HTML 은 스크립트를 막은 iframe. */
function Viewer({ files }: { files: ReviewFile[] }) {
  const [sel, setSel] = useState(files[0]?.id);
  const f = files.find((x) => x.id === sel) ?? files[0];
  if (!f) return <Empty>올라온 문서가 없습니다</Empty>;
  const src = `/api/files/${f.id}`;
  const html = f.mime.startsWith("text/html");
  const viewable = html || f.mime === "application/pdf";
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {files.length > 1 && files.map((x) => (
          <button key={x.id} onClick={() => setSel(x.id)}
                  className={cx("rounded-lg border px-3 py-1.5 text-[13px] font-semibold",
                    x.id === f.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-2 hover:bg-surface-2")}>
            {x.label || x.name}
          </button>
        ))}
        <span className="flex-1" />
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2">
          <Icon name="eye" /> 새 창
        </a>
        <a href={`${src}?download=1`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2">
          <Icon name="file" /> 받기 · {kb(f.size)}
        </a>
      </div>
      {viewable ? (
        <iframe key={`${f.id}-${f.updated_at}`} src={`${src}?v=${encodeURIComponent(f.updated_at ?? "")}`} title={f.label || f.name}
                sandbox={html ? "" : undefined}
                className={cx("h-[72vh] min-h-[420px] w-full rounded-xl border border-line", html ? "bg-white" : "bg-surface-2")} />
      ) : (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-10 text-center text-[13px] text-ink-2">
          {f.name} — 받아서 엽니다
        </div>
      )}
    </div>
  );
}

function DecidePanel({ r, onDone, blocked }: { r: ReviewDetail; onDone: () => void; blocked: string }) {
  const [mode, setMode] = useState<"" | "reject">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function decide(approve: boolean) {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/reviews/${r.id}/decide`, { method: "POST", body: JSON.stringify({ approve, note: note.trim() }) });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "처리하지 못했습니다");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="결정" icon="stamp">
      {err && <div className="mb-3 rounded-lg bg-err-soft px-3 py-2 text-[13px] text-err">{err}</div>}
      {!err && r.process_state === "error" && r.process_message && (
        <div className="mb-3 rounded-lg bg-err-soft px-3 py-2 text-[13px] text-err">이전 결정을 3080 이 처리하지 못했습니다 — {r.process_message}</div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder={mode === "reject" ? "반려 사유 (필수)" : "의견 (선택)"}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-brand" />
      {blocked && <div className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">{blocked}</div>}
      <div className="mt-3 flex gap-2">
        {mode === "reject" ? (
          <>
            <button disabled={busy || !!blocked || !note.trim()} onClick={() => decide(false)}
                    className="flex-1 rounded-lg bg-err py-2.5 text-[14px] font-semibold text-white disabled:opacity-50">
              {busy ? "처리 중…" : "반려"}
            </button>
            <button disabled={busy} onClick={() => setMode("")}
                    className="rounded-lg border border-line px-4 py-2.5 text-[14px] font-semibold text-ink-2 hover:bg-surface-2">취소</button>
          </>
        ) : (
          <>
            <button disabled={busy || !!blocked} onClick={() => decide(true)}
                    className="flex-1 rounded-lg bg-brand py-2.5 text-[14px] font-semibold text-white hover:bg-brand-ink disabled:opacity-50">
              {busy ? "처리 중…" : "승인"}
            </button>
            <button disabled={busy || !!blocked} onClick={() => setMode("reject")}
                    className="rounded-lg border border-line px-4 py-2.5 text-[14px] font-semibold text-err hover:bg-err-soft">반려</button>
          </>
        )}
      </div>
    </Card>
  );
}

function Outcome({ r }: { r: ReviewDetail }) {
  const tone = r.process_state === "error" ? "bg-err-soft text-err"
    : r.process_state === "waiting" ? "bg-info-soft text-info"
    : r.status === "approved" ? "bg-ok-soft text-ok"
    : r.status === "rejected" ? "bg-err-soft text-err" : "bg-muted-soft text-ink-2";
  const head = r.status === "closed" ? (r.process_message || "3080 에서 처리됨")
    : `${r.decided_by} 님이 ${r.status === "approved" ? "승인" : "반려"} · ${when(r.decided_at)}`;
  const tail = r.status === "closed" ? ""
    : r.process_state === "waiting" ? "3080 이 이어서 처리하는 중"
    : r.process_message;
  return (
    <div className={cx("rounded-xl px-4 py-3 text-[13.5px]", tone)}>
      <div className="font-semibold">{head}</div>
      {r.note && <div className="mt-1 whitespace-pre-wrap opacity-90">{r.note}</div>}
      {tail && <div className="mt-1 opacity-90">{tail}</div>}
    </div>
  );
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // 결정 직후 3080 처리 결과를 기다리는 동안만 자주 새로 읽는다
  const { data: r, error, loading, reload } = useApi<ReviewDetail>(`/api/reviews/${id}`,
    (d) => (d?.process_state === "waiting" || d?.edit?.state === "waiting" ? 5_000 : 30_000));
  const [tab, setTab] = useState<"doc" | "sel">("doc");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState("");
  const onDirty = useCallback((d: boolean) => setDirty(d), []);
  useEffect(() => { if (r) document.title = `${r.product} ${r.version} · ${KIND_LABEL[r.kind]?.label ?? ""}`; }, [r]);

  if (loading && !r) return <Skeleton rows={6} />;
  if (!r) return <Empty>{error || "검수 건이 없습니다"}</Empty>;
  const kind = KIND_LABEL[r.kind];
  const sel = r.summary?.selection;
  const editWaiting = r.edit?.state === "waiting";
  const selLocked = !sel?.editable || !r.can_decide || editWaiting;
  const blocked = editWaiting ? "3080 이 저장한 선별표로 전체 이력 RN 을 다시 만드는 중입니다"
    : dirty ? "공개 선별표에 저장하지 않은 변경이 있습니다" : "";

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" /> 목록
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12.5px] font-semibold text-brand-ink">{kind?.label} · {kind?.target}</div>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight">{r.product} {r.version}</h1>
          <div className="mt-1 text-[13px] text-ink-3">요청 {r.requested_by} · {when(r.requested_at)} · 작업 #{r.job_id}</div>
        </div>
        <ReviewState r={r} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {sel && (
            <div className="mb-3 flex rounded-lg border border-line bg-surface p-0.5 text-[13px] font-semibold sm:inline-flex">
              {([["doc", "문서"], ["sel", sel.editable && r.can_decide ? "공개 선별표 · 입력값 수정" : "공개 선별표 · 입력값"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                        className={cx("flex-1 rounded-md px-3.5 py-1.5", tab === k ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>
                  {label}{k === "sel" && dirty && <span className="ml-1">●</span>}
                </button>
              ))}
            </div>
          )}
          {r.edit && r.edit.state !== "done" && (
            <div className={cx("mb-3 rounded-xl px-4 py-3 text-[13.5px]", r.edit.state === "waiting" ? "bg-info-soft text-info" : "bg-err-soft text-err")}>
              {r.edit.state === "waiting"
                ? `${r.edit.by_user} 님이 저장한 선별표를 3080 이 반영하는 중 — 전체 이력 RN 을 다시 만들어 올립니다`
                : `선별표 반영 실패 — ${r.edit.message}`}
            </div>
          )}
          {saved && r.edit?.state === "done" && (
            <div className="mb-3 rounded-xl bg-ok-soft px-4 py-3 text-[13.5px] text-ok">{r.edit.message || "반영했습니다"}</div>
          )}
          <div className={cx(tab !== "doc" && sel && "hidden")}>
            <Card title="문서" icon="file"><Viewer files={r.files} /></Card>
          </div>
          {sel && (
            <div className={cx(tab !== "sel" && "hidden")}>
              <SelectionEditor reviewId={r.id} sel={sel} locked={selLocked} onDirty={onDirty}
                               onSaved={(m) => { setSaved(m); reload(); }} />
            </div>
          )}
        </div>
        <div className="space-y-5">
          {r.can_decide ? <DecidePanel r={r} onDone={reload} blocked={blocked} /> : <Outcome r={r} />}

          {(r.summary?.lines?.length || r.summary?.revision?.length) ? (
            <Card title="변경 내용" icon="rounds">
              {r.summary.lines?.map((l) => (
                <div key={l.label} className="flex gap-3 py-1 text-[13px]">
                  <span className="w-20 shrink-0 text-ink-3">{l.label}</span><span className="min-w-0 break-words">{l.value}</span>
                </div>
              ))}
              {!!r.summary.revision?.length && (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
                  {r.summary.revision.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              )}
            </Card>
          ) : null}

          <Card title="처리 기록" icon="inbox">
            {r.events.length ? (
              <ol className="space-y-2.5">
                {r.events.map((e, i) => (
                  <li key={i} className="text-[13px]">
                    <div>{e.what}</div>
                    <div className="text-[11.5px] text-ink-3">{e.who} · {when(e.at)}</div>
                  </li>
                ))}
              </ol>
            ) : <div className="text-[13px] text-ink-3">기록이 없습니다</div>}
          </Card>
        </div>
      </div>
    </>
  );
}
