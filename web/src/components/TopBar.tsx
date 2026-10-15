"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, useApi, type Me } from "@/lib/api";
import { Icon } from "./Icons";
import { ThemeCycle } from "./ThemeToggle";

const ROLE: Record<string, string> = { admin: "관리자", mid_reviewer: "RN 승인자", final_reviewer: "최종 승인자" };

/** 위쪽 머리줄 — 결재자는 휴대폰으로도 보므로 사이드바 없이 한 줄로. */
export default function TopBar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useApi<Me>("/api/me");

  async function logout() {
    await api("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#5b8cff] to-[#2f6bff] text-[12px] font-extrabold text-white">tw</span>
            <span className="leading-tight">
              <span className="block text-[14.5px] font-bold">TW Automation 검수</span>
              <span className="hidden text-[11px] text-ink-3 sm:block">Release Note · 뉴스레터 · License 결재</span>
            </span>
          </Link>
          <span className="flex-1" />
          {me.data && (
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-[13px] font-semibold">{me.data.display_name || me.data.username}</span>
              <span className="block text-[11px] text-ink-3">{ROLE[me.data.role] ?? me.data.role}</span>
            </span>
          )}
          <ThemeCycle className="text-ink-3 hover:bg-surface-2 hover:text-ink" />
          <button onClick={logout} title="로그아웃" aria-label="로그아웃" className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
            <Icon name="logout" />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1680px] px-4 py-6">{children}</main>
    </div>
  );
}
