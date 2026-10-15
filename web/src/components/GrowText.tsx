"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cx } from "./ui";

/** 내용만큼 늘어나는 입력 칸 — 화면에 처음 나타날 때(크기가 0 이었다가 생길 때)도 다시 잰다. */
export default function GrowText({ value, onChange, disabled, placeholder, className }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx("block min-h-[38px] w-full resize-none overflow-hidden rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] leading-relaxed text-ink outline-none transition",
        "focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:border-transparent disabled:bg-surface-2 disabled:text-ink", className)} />
  );
}
