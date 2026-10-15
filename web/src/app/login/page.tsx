"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthField, AuthShell, authInput } from "@/components/AuthShell";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      router.replace(params.get("next") || "/");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "로그인 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {err && <div className="mb-4 rounded-lg bg-err-soft px-3 py-2.5 text-[13px] text-err">{err}</div>}
      <AuthField id="u" label="아이디">
        <input id="u" autoFocus autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} className={authInput} />
      </AuthField>
      <AuthField id="p" label="비밀번호">
        <input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} className={authInput} />
      </AuthField>
      <button disabled={busy || !username || !password}
              className="mt-1 w-full rounded-lg bg-brand py-2.5 text-[14px] font-semibold text-white hover:bg-brand-ink disabled:opacity-50">
        {busy ? "확인 중…" : "로그인"}
      </button>
      <p className="mt-4 text-center text-[12px] text-ink-3">TW Automation(3080) 계정으로 로그인합니다 · 결재자만</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell sub="Release Note · 뉴스레터 결재">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
