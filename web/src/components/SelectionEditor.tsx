"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icons";
import { Empty, Tag, cx } from "./ui";
import InputFields, { type LiveField } from "./job/InputFields";
import { Btn, inputCls } from "./job/kit";
import { ago, api, type SelRow, type Selection } from "@/lib/api";

type Filter = "all" | "Y" | "X" | "changed";

function AutoText({ value, onChange, disabled, placeholder }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; }
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputCls, "resize-none overflow-hidden py-1.5 leading-relaxed")} />
  );
}

/**
 * 공개 선별표 · 입력값 — 3080 RN 승인 화면과 같은 규칙.
 * RN 승인(1차) 결재자는 반영/미반영 · 수정 내용(RN 문구) · 직접 추가 행 · 입력값을 고쳐 저장하고(3080 이 전체 이력 RN 을 다시 만든다),
 * 최종 검수는 읽기만 한다.
 */
export default function SelectionEditor({ reviewId, sel, locked, onDirty, onSaved }: {
  reviewId: string; sel: Selection; locked: boolean;
  onDirty: (dirty: boolean) => void; onSaved: (message: string) => void;
}) {
  const [rows, setRows] = useState<SelRow[]>([]);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [openReason, setOpenReason] = useState("");
  const [fields, setFields] = useState<LiveField[]>([]);
  const [origF, setOrigF] = useState<Record<string, string>>({});

  function reset(d: Selection) {
    setRows(d.rows.map((r) => ({ ...r })));
    setOrig(Object.fromEntries(d.rows.map((r) => [String(r.no), `${r.include}|${r.apply_note}`])));
    const fs = d.inputs.fields.map((f) => ({ ...f, uid: f.key || f.label }));
    setFields(fs);
    setOrigF(Object.fromEntries(fs.map((f) => [f.uid, f.value])));
  }
  // 3080 이 새 선별표를 올리면(저장 반영 · 다른 곳에서 수정) 그것으로 다시 깐다
  const stamp = `${sel.edited_at}|${sel.rows.length}`;
  useEffect(() => {
    reset(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const sig = (r: SelRow) => `${r.include}|${r.apply_note}`;
  const changed = (r: SelRow) => r.manual ? !!r.apply_note.trim() && orig[String(r.no)] !== sig(r) : orig[String(r.no)] !== sig(r);
  const fieldsDirty = fields.length !== Object.keys(origF).length || fields.some((f) => origF[f.uid] !== f.value);
  const dirty = !locked && (rows.some(changed) || rows.length !== sel.rows.length || fieldsDirty);
  const nY = rows.filter((r) => r.include === "Y").length;

  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) =>
      (filter === "all" || (filter === "changed" ? changed(r) : r.include === filter)) &&
      (!ql || `${r.no} ${r.issue} ${r.apply_note} ${r.team} ${r.customer} ${r.redmine}`.toLowerCase().includes(ql)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, q, orig]);

  function patch(no: SelRow["no"], p: Partial<SelRow>) {
    setRows((rs) => rs.map((r) => (String(r.no) === String(no) ? { ...r, ...p } : r)));
  }
  function toggle(r: SelRow) {
    const on = r.include !== "Y";
    const p: Partial<SelRow> = { include: on ? "Y" : "X" };
    if (on && !r.apply_note.trim()) p.apply_note = r.public ?? "";   // 반영 항목은 실릴 문구가 늘 보여야 한다
    patch(r.no, p);
  }
  function addRow() {
    const nums = rows.map((r) => Number(r.no)).filter((n) => Number.isFinite(n));
    const no = (nums.length ? Math.max(...nums) : 0) + 1;
    setRows((rs) => [...rs, { no, issue: "", include: "Y", apply_note: "", reason: "직접 추가", public: "", manual: true }]);
    setFilter("all");
  }
  async function save() {
    setSaving(true);
    setErr("");
    try {
      const r = await api<{ message: string }>(`/api/reviews/${reviewId}/selection`, {
        method: "POST", body: JSON.stringify({ rows, inputs: fields.map((f) => ({ key: f.key, label: f.label, value: f.value })) }),
      });
      onSaved(r.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const FILTERS: [Filter, string, number][] = [
    ["all", "전체", rows.length], ["Y", "반영", nY], ["X", "미반영", rows.length - nY], ["changed", "고친 것", rows.filter(changed).length],
  ];

  return (
    <div>
      <p className="mb-3 text-[13px] text-ink-2">
        반영한 항목의 <b>수정 내용</b>이 그대로 RN 문구가 되고, <b>입력 값</b>은 RN 의 각 항목 칸에 들어갑니다.
        {sel.edited_by && <span className="text-ink-3"> · 마지막 저장 {sel.edited_by} {ago(sel.edited_at)}</span>}
      </p>

      <InputFields fields={fields} orig={origF} editable={sel.inputs.editable} nowVersion={sel.inputs.now_version}
                   locked={locked} onChange={setFields} />

      <div className="sticky top-14 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-2 bg-bg/95 px-1 py-2 backdrop-blur">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {FILTERS.map(([f, label, n]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cx("rounded-md px-3 py-1.5 text-[13px] font-semibold", filter === f ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>
              {label} <span className={cx("ml-0.5 text-[11.5px]", filter === f ? "text-white/80" : "text-ink-3")}>{n}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="번호 · 이슈 · 문구 · 팀 · 고객 검색" className={cx(inputCls, "pl-9")} />
        </div>
        {!locked && <Btn onClick={addRow}>+ 행 추가</Btn>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[48px_88px_minmax(0,1fr)_minmax(0,1.15fr)] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-3 lg:grid">
          <span>No</span><span>반영</span><span>이슈</span><span>수정 내용 (RN 문구)</span>
        </div>
        {shown.length === 0 ? <Empty>{rows.length ? "조건에 맞는 행이 없습니다" : "선별 데이터가 없습니다"}</Empty> : shown.map((r) => {
          const on = r.include === "Y";
          const k = String(r.no);
          const ch = !locked && changed(r);
          return (
            <div key={k} className={cx("grid grid-cols-1 gap-3 border-b border-line px-4 py-3 last:border-b-0 lg:grid-cols-[48px_88px_minmax(0,1fr)_minmax(0,1.15fr)]",
              !on && "bg-surface-2/70", ch && "shadow-[inset_3px_0_0_var(--color-brand)]")}>
              <div className="flex items-center gap-2 pt-1 font-mono text-[12.5px] text-ink-3 lg:block">{r.no}{ch && <span className="font-sans text-[10.5px] font-bold text-brand lg:block">수정</span>}</div>
              <div>
                {r.manual ? <Tag tone="ok">직접 추가</Tag> : (
                  <button role="switch" aria-checked={on} disabled={locked} onClick={() => toggle(r)}
                    className={cx("relative inline-flex h-7 w-[78px] items-center rounded-full text-[12px] font-bold transition disabled:opacity-70",
                      on ? "bg-brand text-white" : "bg-muted-soft text-ink-2")}>
                    <span className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-[50px]" : "left-0.5")} />
                    <span className={cx("w-full", on ? "pr-6" : "pl-6")}>{on ? "반영" : "미반영"}</span>
                  </button>
                )}
              </div>
              <div className="min-w-0">
                {r.manual ? <div className="pt-1 text-[12.5px] text-ink-3">이슈에 없는 항목</div> : (
                  <>
                    <div className={cx("text-[13.5px] leading-snug", !on && "text-ink-2")}>{r.issue}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
                      {r.kind && <Tag>시스템</Tag>}
                      {r.sensitive && <Tag tone="warn">고객 민감</Tag>}
                      {r.gubun && <Tag>{r.gubun}</Tag>}
                      {r.team && <span>{r.team}</span>}
                      {r.customer && <span>· {r.customer}</span>}
                      {r.redmine?.startsWith("http") && <a href={r.redmine} target="_blank" rel="noreferrer" className="font-mono text-brand-ink hover:underline">#{r.redmine.split("/").pop()}</a>}
                      {!on && r.exclude_note && <Tag>{r.exclude_note}</Tag>}
                      {r.reason && <button onClick={() => setOpenReason(openReason === k ? "" : k)} className="text-brand-ink hover:underline">{openReason === k ? "판정 사유 접기" : "판정 사유"}</button>}
                    </div>
                    {openReason === k && <div className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-2">{r.reason}</div>}
                  </>
                )}
              </div>
              <div className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1">
                  {locked ? (
                    <div className={cx("pt-1 text-[13px] leading-relaxed", !on && "text-ink-3")}>{on ? r.apply_note : "—"}</div>
                  ) : (
                    <>
                      <AutoText value={r.apply_note} disabled={!on && !r.manual} placeholder={r.manual ? "RN 에 넣을 문구" : r.public}
                        onChange={(v) => patch(r.no, { apply_note: v })} />
                      {on && !r.manual && r.public && r.apply_note.trim() !== r.public.trim() && (
                        <button onClick={() => patch(r.no, { apply_note: r.public ?? "" })} className="mt-1 text-[11.5px] text-ink-3 hover:text-brand-ink">공개 문구로 되돌리기</button>
                      )}
                    </>
                  )}
                </div>
                {r.manual && !locked && (
                  <button onClick={() => setRows((rs) => rs.filter((x) => x !== r))} className="mt-1 rounded-md p-1.5 text-ink-3 hover:bg-err-soft hover:text-err" aria-label="행 삭제">✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="sticky bottom-0 z-10 -mx-1 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <span className="text-[13px] text-ink-2">반영 <b className="text-ink">{nY}</b> · 미반영 {rows.length - nY}</span>
          {dirty ? <Tag tone="warn">저장 안 한 변경 {rows.filter(changed).length + fields.filter((f) => origF[f.uid] !== f.value).length}건</Tag> : <span className="text-[12.5px] text-ink-3">변경 없음</span>}
          {err && <span className="text-[12.5px] text-err">{err}</span>}
          <span className="flex-1" />
          {dirty && <Btn kind="ghost" onClick={() => reset(sel)}>되돌리기</Btn>}
          <Btn kind="primary" busy={saving} disabled={!dirty} onClick={save}>저장하고 RN 다시 만들기</Btn>
        </div>
      )}
    </div>
  );
}
