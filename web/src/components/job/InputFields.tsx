"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";
import GrowText from "@/components/GrowText";
import { Tag, cx } from "@/components/ui";
import type { InputField } from "@/lib/api";
import { Btn, inputCls } from "./kit";

export type LiveField = InputField & { uid: string };

/** 입력 값 칸(GMS/SDK/Audio/Touch/Wi-Fi/보안패치…) — 선별표와 함께 저장된다.
 *  값을 고치면 문서에서 그 항목 위에 찍히는 판(◼)이 이번 판으로 바뀐다. */
export default function InputFields({ fields, orig, editable, nowVersion, locked, onChange }: {
  fields: LiveField[]; orig: Record<string, string>; editable: boolean; nowVersion: string; locked: boolean;
  onChange: (f: LiveField[]) => void;
}) {
  const [name, setName] = useState("");
  const empty = fields.filter((f) => f.required && !f.value.trim());

  function set(uid: string, value: string) {
    onChange(fields.map((f) => (f.uid === uid ? { ...f, value } : f)));
  }
  function add() {
    const label = name.replace(/^\s*\d{1,2}\.\s*/, "").trim();
    if (!label) return;
    onChange([...fields, { uid: `new-${Date.now()}`, key: "", label, required: false, value: "", manual: true, version: "" }]);
    setName("");
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h2 className="text-[16px] font-bold">입력 값</h2>
        <span className="text-[12.5px] text-ink-3">GMS · SDK · Audio · Touch · Wi-Fi · 보안패치</span>
        {empty.length > 0 && <span className="ml-auto text-[12.5px] font-semibold text-warn">빈 칸 {empty.length}</span>}
      </header>
      <div className="hidden grid-cols-[minmax(140px,200px)_minmax(0,1fr)_200px] gap-3 border-b border-line px-4 py-2 text-[12px] font-bold text-ink-3 md:grid">
        <span>항목</span><span>값</span><span className="text-right">문서에 찍히는 판</span>
      </div>
      <div className="divide-y divide-line">
        {fields.map((f) => {
          const was = orig[f.uid];
          const changed = was !== undefined ? was !== f.value : !!f.value.trim();
          const ver = !f.value.trim() ? "—" : changed ? nowVersion : (f.version || nowVersion);
          const warn = f.required && !f.value.trim();
          return (
            <div key={f.uid} className={cx("grid gap-x-3 gap-y-1.5 px-4 py-2.5 md:grid-cols-[minmax(140px,200px)_minmax(0,1fr)_200px] md:items-start",
              changed && !locked && "shadow-[inset_3px_0_0_var(--color-brand)]")}>
              <div className="flex flex-wrap items-center gap-1.5 md:pt-2">
                <span className="text-[13.5px] font-semibold leading-snug">{f.label}</span>
                {changed && !locked && <Tag tone="warn">수정</Tag>}
                {f.manual && !changed && <Tag>직접 입력</Tag>}
                {!f.key && <Tag tone="ok">새 항목</Tag>}
              </div>
              {locked ? (
                <div className={cx("whitespace-pre-wrap break-words rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13.5px] leading-relaxed",
                  f.value.trim() ? "text-ink" : "text-ink-3")}>{f.value.trim() || "비어 있음"}</div>
              ) : (
                <GrowText value={f.value} onChange={(v) => set(f.uid, v)} placeholder={warn ? "입력 필요" : ""}
                          className={cx("font-mono text-[13.5px]", warn && "border-warn/70 bg-warn-soft/40")} />
              )}
              <div className="flex items-start justify-between gap-2 md:justify-end md:pt-2">
                <span className="whitespace-nowrap font-mono text-[12px] text-ink-2" title="문서에서 이 항목 위에 찍히는 판">◼ {ver}</span>
                {editable && !locked && (
                  <button onClick={() => onChange(fields.filter((x) => x.uid !== f.uid))} aria-label={`${f.label} 빼기`}
                          className="rounded-md p-1 text-ink-3 hover:bg-err-soft hover:text-err">✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editable && !locked && (
        <div className="flex gap-2 border-t border-line bg-surface-2 px-4 py-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="항목 추가 — 예: Scanner version information"
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={cx(inputCls, "flex-1")} />
          <Btn onClick={add} disabled={!name.trim()}><Icon name="check" className="h-4 w-4" />추가</Btn>
        </div>
      )}
    </section>
  );
}
