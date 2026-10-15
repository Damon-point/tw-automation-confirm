import "server-only";
import postgres from "postgres";

/**
 * 검수 웹 DB — Postgres(배포: Supabase, 개발: 이 PC 의 로컬 Postgres).
 * 서버리스에서 함수마다 연결이 생기므로 연결 수를 작게, Supabase 연결 풀러(트랜잭션 모드)를 쓰므로 prepare 는 끈다.
 */
const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres>; __schema?: Promise<void> };

const DB_URL = process.env.DATABASE_URL ?? "";
/** 로컬 Postgres 는 SSL 없이, Supabase 같은 바깥 DB 는 SSL 필수. */
const LOCAL_DB = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB_URL);

export const sql =
  g.__sql ??
  (g.__sql = postgres(DB_URL, {
    ssl: LOCAL_DB ? false : "require",
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  }));

/** 결재 종류 — 3080 의 RN 1차 승인 · 최종 검수 · 뉴스레터 결재와 같다. */
export const KINDS = {
  mid: { label: "RN 승인 (1차)", target: "Release Note (전체 이력)", roles: ["mid_reviewer", "admin"] },
  final: { label: "최종 검수 (2차)", target: "Release Note for Sales", roles: ["final_reviewer", "admin"] },
  newsletter: { label: "뉴스레터 결재", target: "Newsletter", roles: ["final_reviewer", "admin"] },
} as const;
export type Kind = keyof typeof KINDS;

const SCHEMA = `
create table if not exists confirm_users (
  username text primary key,
  display_name text not null default '',
  email text not null default '',
  role text not null,
  password_hash text not null,
  active boolean not null default true,
  synced_at timestamptz not null default now()
);
create table if not exists confirm_reviews (
  id bigserial primary key,
  source_key text not null unique,
  job_id integer not null,
  kind text not null,
  product text not null default '',
  version text not null default '',
  requested_by text not null default '',
  requested_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  decided_by text not null default '',
  decided_at timestamptz,
  decided_via text not null default '',
  note text not null default '',
  process_state text not null default '',
  process_message text not null default '',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_confirm_reviews_status on confirm_reviews (status);
create table if not exists confirm_files (
  id bigserial primary key,
  review_id bigint not null references confirm_reviews (id) on delete cascade,
  name text not null,
  label text not null default '',
  mime text not null,
  size integer not null,
  data bytea not null,
  created_at timestamptz not null default now(),
  unique (review_id, name)
);
create table if not exists confirm_events (
  id bigserial primary key,
  review_id bigint references confirm_reviews (id) on delete cascade,
  at timestamptz not null default now(),
  who text not null default '',
  what text not null default ''
);
`;

/** 표가 없으면 만든다(첫 요청 한 번). 배포처 DB 를 따로 준비하지 않아도 된다. */
export function ensureSchema(): Promise<void> {
  return (g.__schema ??= sql.unsafe(SCHEMA).then(() => undefined));
}
