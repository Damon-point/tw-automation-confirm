# tw-automation-confirm

TW Automation 의 **검수(결재)만** 떼어 낸 웹 앱. 결재자가 사내망 밖(휴대폰 포함)에서도 결정할 수 있게 한다.

| 결재 | 대상 문서 | 결정할 수 있는 역할 |
|---|---|---|
| RN 승인 (1차) | Release Note 전체 이력 (PDF) | mid_reviewer · admin |
| 최종 검수 (2차) | Release Note for Sales (PDF) | final_reviewer · admin |
| 뉴스레터 결재 | Newsletter EN/KR (HTML) | final_reviewer · admin |

## 구조

```
 결재자 브라우저 ──▶ Vercel (web/, Next.js) ──▶ Supabase Postgres
                                   ▲
                                   │  HTTPS, 3080 PC 에서 바깥으로만 (30초마다)
                          tw-automation-v2 (3080) · api/confirm_sync.py
```

- 3080 PC 는 열지 않는다. 3080 이 웹으로 **올리고**(결재자 계정 · 요청 · 문서), 웹의 결정을 **받아 와서** 기존 처리(PDF 확정 · 파일서버 저장 · 결과 메일)를 그대로 돌린다.
- 로그인은 3080 계정 그대로 — 3080 이 결재자 bcrypt 해시를 올린다. 첫 로그인 비밀번호를 아직 안 바꾼 계정은 올리지 않는다. 3080 에서 결재자가 아니게 되면 다음 동기화에서 막힌다.
- 3080 화면의 결정 버튼도 그대로 쓴다. 먼저 처리된 결정이 이긴다 — 늦게 온 웹 결정은 반영하지 않고 닫는다.
- 3080 처리가 실패하면(예: 결과 메일 발송 실패) 웹 건은 결정 대기로 돌아가 다시 결정할 수 있다.

## 로컬 실행

```powershell
cd web
copy .env.example .env.local   # DATABASE_URL · SESSION_SECRET · SYNC_TOKEN
npm install
npm run build; npm start        # http://localhost:3060
```

3080 쪽(tw-automation-v2 `backend/.env`):

```
TWN_CONFIRM_URL=http://127.0.0.1:3060        # 배포 뒤에는 https://<vercel 주소>
TWN_CONFIRM_TOKEN=<web 의 SYNC_TOKEN 과 같은 값>
TWN_CONFIRM_PUBLIC_URL=                       # 결재 요청 메일에 넣을 웹 주소(비우면 안 넣음)
```

둘(URL · TOKEN) 다 있어야 3080 API 기동 때 `confirm_sync` 루프가 돈다.

## 배포 (Vercel + Supabase)

1. Supabase 프로젝트(지역 Seoul) → Connect → Transaction pooler(6543) 주소를 `DATABASE_URL` 로.
2. Vercel 프로젝트 Root Directory = `web`, 환경변수 `DATABASE_URL` · `SESSION_SECRET`(32자 이상) · `SYNC_TOKEN`.
3. 표는 첫 동기화 때 자동으로 만든다(`ensureSchema`). RLS 를 켜 두어 Supabase Data API(anon 키)로는 읽히지 않는다.
   함수 지역은 `web/vercel.json` 에서 서울(icn1) — Supabase 와 같은 지역에 둔다.
4. 3080 `backend/.env` 의 `TWN_CONFIRM_URL` 을 Vercel 주소로 바꾸고 3080 API 재시작.

문서는 요청 하나에 하나씩 올린다 — Vercel 함수 본문 한도(4.5MB) 때문에 원본 3.3MB 까지.

## API

| 경로 | 쓰는 쪽 | 하는 일 |
|---|---|---|
| `POST /api/login` · `/api/logout` · `GET /api/me` | 브라우저 | 세션(HMAC 서명 쿠키, 12시간) |
| `GET /api/reviews?scope=open\|done` · `GET /api/reviews/:id` | 브라우저 | 목록 · 상세 |
| `POST /api/reviews/:id/decide` | 브라우저 | 승인 · 반려(사유 필수) |
| `GET /api/files/:id` | 브라우저 | 문서 — HTML 은 sandbox CSP |
| `POST /api/sync/push` · `/api/sync/file` · `GET /api/sync/decisions` · `POST /api/sync/ack` | 3080 (Bearer SYNC_TOKEN) | 동기화 |
