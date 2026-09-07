# DATABASE_SCHEMA.md

PostgreSQL 16 + Prisma 6。実体は `prisma/schema.prisma`。ここでは意図と関係を説明する。

## テナント / 認証

| テーブル | 役割 |
|---|---|
| `organizations` | テナント。`plan`, `settings(JSON)`, `appName`（管理画面から変更可能なシステム名） |
| `users` | ログインユーザー。`passwordHash`(bcrypt) |
| `memberships` | user × organization × role (ADMIN / MANAGER / SALES / VIEWER) |
| `company_profiles` | 営業会社プロフィール（PHASE 3）。1組織1件。JSON配列で実績・FAQ等 |

## プラットフォーム

| テーブル | 役割 |
|---|---|
| `platforms` | コネクタ定義（key, 表示名, API有無, 既定送信モード, 規約ノート） |
| `platform_accounts` | 組織ごとの接続設定。`credentialsEncrypted`(AES-256-GCM), `sendMode`(AUTO/MANUAL_APPROVAL/MANUAL_ONLY), `enabled` |
| `platform_limits` | 組織×プラットフォームの daily/hourly 送信上限、クライアント接触上限 |

## 案件

| テーブル | 役割 |
|---|---|
| `jobs` | 正規化 Job モデル（PHASE 1 の全フィールド）。`(organizationId, platformKey, externalJobId)` ユニークで重複取得を防止 |
| `job_analyses` | AI解析JSON（PHASE 2）+ 各スコア（fit / profit / clientQuality / winProbability / urgency / risk / opportunity） |

## 営業

| テーブル | 役割 |
|---|---|
| `opportunities` | 商談（Lead）。`status`(LeadStatus, Kanban列)。job・client・proposal・conversation を束ねる |
| `proposals` | 提案（1 job 1 proposal で重複送信禁止）。`status`(ProposalStatus), `sendMode`, `detectedLanguage`, `proposalOriginal`, `proposalTranslated`, `length`, `tone`, `variantLabel`(A/B) |
| `proposal_versions` | 版履歴（再生成・編集ごと） |
| `conversations` | Thread Memory の根。`conversationId` で job/proposal/quote/messages を束ねる |
| `messages` | 各メッセージ。`direction`(INBOUND/OUTBOUND), `authorType`(AI/HUMAN/CLIENT), `analysis`(返信解析JSON), `approvalStatus` |
| `quotes` | 見積。`status`, 明細JSON, `requiresHumanApproval` |
| `deals` | 受注。`summary`(Deal Summary JSON), `checklist`, `approvedByUserId`, `wonAt` |

## CRM

| テーブル | 役割 |
|---|---|
| `clients` | Companies。国・言語・評価・履歴 |
| `contacts` | 担当者 |
| `activities` | タイムライン（送信 / 返信 / ステージ変更 / タスク） |
| `tasks` | 人間向けタスク（承認待ち等） |

## AI / 自動化 / 運用

| テーブル | 役割 |
|---|---|
| `ai_runs` | 全AI呼び出し。agent, provider, model, tokens, costUsd, latency, input/output digest |
| `prompt_templates` | agent ごとのプロンプト（組織で上書き可） |
| `automation_rules` | ルール（trigger, conditions JSON, actions JSON, enabled, priority） |
| `automation_runs` | ルール実行履歴 |
| `performance_memory` | 提案特徴量（opening/length/price/CTA/tone/portfolio/language/platform/category/country）と結果（replied/won）の集計 |
| `language_settings` | 組織の既定言語・対応言語・翻訳ポリシー |
| `audit_logs` | 監査ログ（actorType USER/AI/SYSTEM, actorId, agent, action, entity, before/after, reason） |

## 主要 Enum

- `Role`: ADMIN, MANAGER, SALES, VIEWER
- `Plan`: STARTER, PRO, BUSINESS, ENTERPRISE
- `SendMode`: AUTO, MANUAL_APPROVAL, MANUAL_ONLY
- `ProposalStatus`: DRAFT, AI_REVIEWED, WAITING_APPROVAL, APPROVED, SCHEDULED, SENT, FAILED, REPLIED, CLOSED
- `LeadStatus`: DISCOVERED, QUALIFIED, PROPOSAL_CREATED, PROPOSAL_SENT, REPLIED, NEGOTIATING, MEETING_REQUESTED, QUOTE_SENT, FINAL_NEGOTIATION, VERBAL_ACCEPT, WON, LOST
- `ReplyCategory`: INTERESTED, QUESTION, PRICE_NEGOTIATION, SCHEDULE_NEGOTIATION, TECHNICAL_QUESTION, REQUEST_PORTFOLIO, REQUEST_MEETING, OBJECTION, REJECTION, ACCEPTANCE, UNKNOWN
- `JobStatus`: NEW, ANALYZED, QUALIFIED, EXCLUDED, ARCHIVED

## ER 概要

```
Organization 1─* Membership *─1 User
Organization 1─1 CompanyProfile
Organization 1─* PlatformAccount *─1 Platform
Organization 1─* Job 1─1 JobAnalysis
Job 1─1 Opportunity 1─1 Proposal 1─* ProposalVersion
Opportunity 1─1 Conversation 1─* Message
Opportunity 1─* Quote
Opportunity 1─1 Deal
Client 1─* Contact ; Client 1─* Opportunity
Organization 1─* AutomationRule 1─* AutomationRun
Organization 1─* AiRun ; Organization 1─* AuditLog
```

## インデックス方針

- 全業務テーブル：`organizationId` 先頭の複合インデックス
- `jobs`: `(organizationId, status)`, `(organizationId, platformKey)`, `(organizationId, postedAt)`
- `proposals`: `(organizationId, status)`, unique `(jobId)`
- `messages`: `(conversationId, createdAt)`
- `ai_runs`: `(organizationId, createdAt)`（コスト集計）
