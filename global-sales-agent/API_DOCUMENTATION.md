# API_DOCUMENTATION.md

すべての API は `/api/*`。認証は Auth.js セッション Cookie（同一オリジン）。レスポンスは `{ ok: true, data }` または `{ ok: false, error, details? }`。
書き込み系は `Origin` / `Sec-Fetch-Site` による CSRF チェックがあります。RBAC の権限名は `src/lib/rbac.ts` を参照。

## 認証

| Method | Path | 説明 |
|---|---|---|
| GET/POST | /api/auth/[...nextauth] | Auth.js（Credentials）。ブラウザからは `signIn("credentials", { email, password })` |
| GET | /api/health | ヘルスチェック（認証不要） |

## 案件（Jobs）

| Method | Path | 権限 | Body / Query |
|---|---|---|---|
| GET | /api/jobs | job:read | `status, platformKey, category, country, q, minScore, page, pageSize, sort=score|posted|budget` |
| POST | /api/jobs/discover | job:discover | `{ platformKey?, limit?, analyze? }` → Scout Agent 実行 |
| POST | /api/jobs/import | job:discover | `{ rows?: NormalizedJob[], csv?: string, platform?, analyze }` |
| GET | /api/jobs/:id | job:read | 解析・商談・提案・バージョン込み |
| POST | /api/jobs/:id/analyze | job:analyze | Analyst Agent → JobAnalysis + Opportunity Score |
| POST | /api/jobs/:id/exclude | job:analyze | `{ reason }` |
| POST | /api/jobs/:id/proposal | proposal:create | `{ length?, tone?, language?, variantLabel?, regenerate? }` |

## 提案（Proposals）

| Method | Path | 権限 | 説明 |
|---|---|---|---|
| GET | /api/proposals | proposal:read | `status, platformKey, page` |
| GET | /api/proposals/:id | proposal:read | |
| PATCH | /api/proposals/:id | proposal:edit | `{ proposalTranslated, proposalOriginal?, changeReason? }` → 新バージョン |
| POST | /api/proposals/:id/approve | proposal:approve | APPROVED → Send Engine |
| POST | /api/proposals/:id/reject | proposal:approve | `{ reason }` |
| POST | /api/proposals/:id/mark-sent | proposal:send | MANUAL_ONLY の手動送信完了 |
| POST | /api/proposals/:id/send | proposal:send | FAILED / SCHEDULED の再送 |

Proposal Status: `DRAFT → AI_REVIEWED → WAITING_APPROVAL → APPROVED → SCHEDULED → SENT → REPLIED → CLOSED` / `FAILED`

## 会話（Conversations / Messages）

| Method | Path | 権限 | 説明 |
|---|---|---|---|
| GET | /api/conversations | conversation:read | `status, pending=1, page` |
| POST | /api/conversations/sync | conversation:read | 各コネクタの `fetchReplies` を実行 |
| GET | /api/conversations/:id | conversation:read | Thread Memory（job / analysis / proposal / quotes / pricingState / deal / messages） |
| POST | /api/conversations/:id/draft | conversation:reply | `{ instruction? }` Reply Agent（承認待ちドラフト） |
| POST | /api/conversations/:id/negotiate | quote:create | Negotiation Agent + Pricing Engine → Quote + ドラフト |
| POST | /api/conversations/:id/messages | conversation:reply | `{ body, send }` 人間が作成 |
| POST | /api/messages/:id/approve | conversation:approve | `{ body? }` 編集して承認送信 |
| POST | /api/messages/:id/reject | conversation:approve | `{ reason? }` |

Reply Category: `INTERESTED, QUESTION, PRICE_NEGOTIATION, SCHEDULE_NEGOTIATION, TECHNICAL_QUESTION, REQUEST_PORTFOLIO, REQUEST_MEETING, OBJECTION, REJECTION, ACCEPTANCE, UNKNOWN`

## 商談 / 受注

| Method | Path | 権限 | 説明 |
|---|---|---|---|
| GET | /api/opportunities | crm:read | Kanban 用 |
| PATCH | /api/opportunities/:id | crm:write | `{ status }`（WON 不可） |
| POST | /api/opportunities/:id/deal-summary | deal:read | Closing Agent → Deal Summary |
| POST | /api/opportunities/:id/lost | crm:write | `{ reason }` |
| GET | /api/deals, /api/deals/:id | deal:read | |
| POST | /api/deals/:id/approve | deal:approve | `{ checklist?, amount?, notes? }` 全項目 confirmed で WON → CRM 同期 |

## CRM

`/api/crm/companies` (GET), `/api/crm/companies/:id` (GET/PATCH), `/api/crm/contacts` (GET/POST), `/api/crm/tasks` (GET), `/api/crm/tasks/:id` (PATCH)

## 自動化

| Method | Path | 説明 |
|---|---|---|
| GET/POST | /api/automation/rules | ルール一覧 / 作成 `{ name, trigger, conditions[], actions[], priority, enabled, stopOnMatch }` |
| PATCH/DELETE | /api/automation/rules/:id | |
| POST | /api/automation/rules/dry-run | `{ conditions }` → 一致件数 |
| GET | /api/automation/runs | 実行ログ |

Condition: `{ field, op, value }` / `{ any: [] }` / `{ all: [] }`、op: `gt gte lt lte eq neq in not_in contains not_contains exists`
Action: `CREATE_PROPOSAL, EXCLUDE_JOB, SET_LEAD_STATUS, GENERATE_REPLY, GENERATE_NEGOTIATION_REPLY, REQUEST_HUMAN_APPROVAL, CREATE_TASK, APPROVE_PROPOSAL, CREATE_DEAL_SUMMARY, NOTIFY`

## 分析 / コスト / 監査

`GET /api/dashboard`, `GET /api/analytics`, `GET /api/costs`, `GET /api/audit?entityType&entityId&actorType&page`

## 設定

| Method | Path | 説明 |
|---|---|---|
| GET/PATCH | /api/settings | `{ appName?, name?, settings?: Partial<OrgSettings> }` |
| GET/PUT | /api/settings/profile | 会社プロフィール |
| GET/PATCH | /api/settings/platforms | `{ platformKey, label?, enabled?, sendMode?, credentials?, config? }` |
| POST | /api/settings/platforms/:key/test | 接続テスト |
| PUT | /api/settings/platforms/:key/limits | `{ dailyLimit, hourlyLimit, maxContactsPerClientPerWeek }` |
| GET/PUT | /api/settings/prompts | エージェント別プロンプト |
| GET/POST | /api/settings/team, PATCH/DELETE /api/settings/team/:id | メンバー管理 |

## Webhook / Demo

| Method | Path | 説明 |
|---|---|---|
| POST | /api/webhooks/:platformKey | `X-Timestamp` + `X-Signature: sha256=HMAC(secret, "ts.body")`（demo は `X-Demo-Secret`）。Body: `{ orgSlug, messages: [{ externalThreadId, externalMessageId, jobExternalId, text, receivedAt? }] }` |
| GET | /api/demo/marketplace/jobs?category&country&limit | Fake Marketplace API（認証不要） |
| GET | /api/demo/marketplace/jobs/:id | |
| POST | /api/demo/marketplace/proposals | `{ job_id, text }` |
| POST | /api/demo/reset | DEMO_MODE のみ。パイプラインデータをリセット |

## 正規化 Job モデル

```json
{ "platform": "upwork", "job_id": "…", "job_url": "…", "client_name": "…", "client_country": "US", "client_language": "en",
  "project_title": "…", "project_description": "…", "category": "Web Development", "required_skills": ["Next.js"],
  "budget_min": 1000, "budget_max": 3000, "currency": "USD", "deadline": "ISO", "proposal_deadline": "ISO",
  "number_of_competitors": 12, "client_rating": 4.8, "client_history": "…", "payment_verified": true,
  "posted_at": "ISO", "raw_text": "…", "source_metadata": {} }
```
