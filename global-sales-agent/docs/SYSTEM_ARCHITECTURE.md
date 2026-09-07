# SYSTEM_ARCHITECTURE.md — GLOBAL SALES AGENT

> 多言語AI営業・案件獲得オートメーションSaaS（AI Sales Agent Platform）
> 管理画面から名称変更可能（既定：**GLOBAL SALES AGENT** / 別名：AI DEAL CLOSER）

## 0. 既存リポジトリとの関係

| 領域 | 内容 | 扱い |
|---|---|---|
| リポジトリ直下 | Dr.Jena コーポレートサイト（静的HTML, GitHub Pages, 日次ニュースAction） | **一切変更しない** |
| `global-sales-agent/` | 本SaaS（Next.js 16 / TypeScript / Prisma / PostgreSQL） | 新規追加。独立した `package.json` を持つ |

既存サイトの HTML / 画像 / `news.json` / `.github/workflows/news.yml` には手を入れず、
SaaS は完全に独立したサブプロジェクトとして共存させる。

## 1. 全体像

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Next.js 16 (App Router)                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐   │
│  │ Dashboard UI │  │ Admin Panel   │  │ REST API (/api/*)            │   │
│  │ (RSC+Client) │  │ Settings/Rules│  │ Zod validated, RBAC, Tenant  │   │
│  └──────┬───────┘  └──────┬────────┘  └───────────┬──────────────────┘   │
│         └─────────────────┴───────────────────────┘                      │
│                             │ Service Layer (src/lib/services)           │
│  ┌──────────────────────────┼─────────────────────────────────────────┐  │
│  │  Agent Orchestration Layer (Supervisor)                            │  │
│  │  Scout · Analyst · Proposal · Reply · Negotiation · Closing        │  │
│  │  Translation · Compliance                                          │  │
│  └──────────────┬──────────────────────────┬──────────────────────────┘  │
│                 │                          │                              │
│      ┌──────────▼──────────┐    ┌──────────▼──────────┐                  │
│      │ AI Provider Layer   │    │ Platform Connectors │                  │
│      │ Anthropic / OpenAI  │    │ coconala, crowdworks│                  │
│      │ Mock (Demo)         │    │ lancers, upwork ... │                  │
│      └─────────────────────┘    └─────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
            │                                 │
   ┌────────▼────────┐              ┌─────────▼─────────┐
   │ PostgreSQL      │              │ Redis + BullMQ    │
   │ (Prisma ORM)    │              │ Queue / Scheduler │
   └─────────────────┘              └───────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │ Worker Process     │
                                    │ (src/worker)       │
                                    │ discovery cron,    │
                                    │ analysis, sending, │
                                    │ reply polling      │
                                    └────────────────────┘
```

## 2. パイプライン（End-to-End）

```
Discovery ─▶ Analysis ─▶ Fit/Opportunity Scoring ─▶ Proposal Generation
   ─▶ Proposal Queue (Compliance / Limits / Approval) ─▶ Send
   ─▶ Reply Ingestion ─▶ Reply Intelligence ─▶ AI Reply / Negotiation
   ─▶ Quote ─▶ Deal Summary (Closing Agent) ─▶ Human Approval ─▶ WON
   ─▶ CRM (Company / Contact / Deal / Activity)
```

各ステップは **Lead Status** と **Proposal Status** の状態遷移として表現され、
すべての遷移は `audit_logs` に「誰が / いつ / どのAIが / どんな判断で / 何を送ったか」を残す。

## 3. 技術スタック

| 層 | 採用 |
|---|---|
| Frontend | Next.js 16 (App Router, RSC), React 19, TypeScript 5.9, Tailwind CSS 4, shadcn/ui スタイルの自前コンポーネント, Recharts, lucide-react |
| Backend | Next.js Route Handlers (`src/app/api/**`) + Service Layer |
| DB | PostgreSQL 16 + Prisma 6 |
| Auth | Auth.js v5 (Credentials + JWT session) / Clerk へ差し替え可能な `auth()` 抽象 |
| AI | `AIProvider` 抽象 → Anthropic Claude / OpenAI / Mock。将来 Gemini 追加可 |
| Queue | BullMQ + Redis（`REDIS_URL` 未設定時は in-process インラインドライバにフォールバック） |
| Cron | Worker 内スケジューラ（`src/worker/index.ts`）。Trigger.dev へ差し替え可能 |
| i18n | next-intl（ja / en UI）+ Language Layer（提案言語 9+言語） |
| Validation | Zod |
| Test | Vitest（unit/integration） + Playwright（E2E） |
| Infra | Docker / docker-compose（app, worker, postgres, redis） |

## 4. ディレクトリ構成

```
global-sales-agent/
├─ docs/                       設計ドキュメント
├─ prisma/
│   ├─ schema.prisma
│   ├─ migrations/
│   └─ seed.ts                 デモ組織・ユーザー・100案件
├─ src/
│   ├─ app/
│   │   ├─ (auth)/login
│   │   ├─ (app)/              認証必須の管理画面
│   │   │   ├─ dashboard  jobs  proposals  pipeline  conversations
│   │   │   ├─ crm/(companies|contacts|deals)  automation  analytics
│   │   │   ├─ costs  audit  settings/(profile|platforms|ai|limits|team|general)
│   │   └─ api/                REST API（Zod + RBAC + Tenant）
│   │        └─ demo/marketplace   Fake Marketplace API
│   ├─ components/  ui/  layout/  charts/  kanban/  ...
│   ├─ lib/
│   │   ├─ ai/          provider abstraction, anthropic, openai, mock, cost
│   │   ├─ agents/      9 agents + orchestrator
│   │   ├─ connectors/  Platform Connector Architecture
│   │   ├─ scoring/     Opportunity Score
│   │   ├─ pricing/     Pricing Engine
│   │   ├─ automation/  Rule Engine
│   │   ├─ language/    Detection + Language Layer
│   │   ├─ queue/       BullMQ / inline driver
│   │   ├─ sending/     Proposal Queue / Limits / Send Engine
│   │   ├─ services/    Domain services (jobs, proposals, conversations, deals, crm, analytics)
│   │   ├─ demo/        Fake marketplace state machine, seed data
│   │   └─ auth.ts rbac.ts tenant.ts audit.ts crypto.ts db.ts settings.ts
│   ├─ worker/          BullMQ worker + scheduler
│   └─ proxy.ts         認証ガード / CSRF Origin チェック / Rate limit
├─ tests/ unit  integration  e2e
├─ Dockerfile  docker-compose.yml  .env.example
└─ README.md  SETUP.md  DEPLOYMENT.md  API_DOCUMENTATION.md
```

## 5. マルチテナント

- すべての業務テーブルは `organizationId` を持つ。
- `src/lib/tenant.ts` の `requireOrg()` がセッションから `orgId` を解決し、
  Service Layer の全クエリは必ず `where: { organizationId }` を付与する。
- テナント横断アクセスは存在しない（SUPER_ADMIN も UI 上は自組織のみ）。
- 料金プラン（STARTER / PRO / BUSINESS / ENTERPRISE）は `Organization.plan` と
  `PLAN_LIMITS`（`src/lib/plans.ts`）で機能・上限を制御。

## 6. デモモード

- `DEMO_MODE=true` かつ AIキー未設定 → `MockAIProvider` が決定論的な解析・提案・返信を生成。
- `demo-marketplace` コネクタが Fake Marketplace API (`/api/demo/marketplace/*`) を叩き、
  100件の架空案件・クライアント返信（興味/価格交渉/質問/拒否/承諾）をシミュレート。
- 外部アカウント不要で 発見→提案→返信→交渉→受注→CRM を完走できる。

## 7. 安全性・コンプライアンス方針

- CAPTCHA回避 / 不正ログイン / アクセス制限回避 / BAN回避 / レート制限回避 / 身元偽装 /
  虚偽実績 / 虚偽レビュー / 無制限大量送信 は **実装しない**（Compliance Agent が送信前に検査）。
- 公式APIがあるプラットフォームは公式API。自動送信が禁止・不明確なプラットフォームは
  `MANUAL_APPROVAL` または `MANUAL_ONLY` を既定にし、人間の承認を必須化。
- 契約締結・価格確定・規約同意・支払条件確定は Human-in-the-loop を必須にできる設定。
