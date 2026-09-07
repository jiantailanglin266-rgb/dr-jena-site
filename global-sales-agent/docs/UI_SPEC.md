# UI_SPEC.md — 管理画面仕様（実装者向け）

Premium AI SaaS（Linear / Stripe / Vercel / Attio 風）。Minimal・Clean・大きめの余白・控えめなアニメーション。PC優先・レスポンシブ。

## 共通ルール

- Next.js 16 App Router。ページは **Server Component** で `requireSession()` → services を直接呼んでデータ取得。操作系は小さな **Client Component**（`"use client"`）で `api()`（`src/lib/client-api.ts`）を叩き、`toast`（sonner）で結果表示、`router.refresh()` で再取得。
- 既存コンポーネントのみ使用：`src/components/ui/*`（button, card, badge(+StatusBadge), input(Input/Textarea/Select/Label/Field), switch, tabs, dialog, table(Table/THead/TBody/TR/TH/TD), misc(PageHeader/StatCard/EmptyState/ScoreRing/ScoreBar/Skeleton/Separator/KV/Flag), dropdown）、`src/components/charts`（TrendChart/FunnelChart/BarBreakdown）。
- ユーティリティ：`cn, formatCurrency, formatPct, formatDate, formatDateTime, timeAgo, truncate, dec`（`src/lib/utils.ts`）。Prisma Decimal は `dec()` で number 化。
- 参考実装：`src/app/(app)/dashboard/page.tsx` と `actions.tsx`。
- `params` は Promise：`const { id } = await params;`
- 全ページで `export const dynamic = "force-dynamic";` は不要（親 layout で指定済み）。
- ラベルは英語ベース＋日本語併記可（i18n JSON への追加は不要）。UI 文言は簡潔に。
- Tailwind 4。色は CSS 変数由来のトークン（`bg-card`, `text-muted-foreground`, `border-border`, `bg-accent-soft`, `text-success` など）。
- E2E テスト用に指定の `data-testid` を必ず付与する。

## API（すべて `{ ok, data }` を返す。`api<T>(path, {method, json})`）

| Path | Method | 用途 |
|---|---|---|
| /api/jobs?status&platformKey&category&country&q&minScore&page&pageSize&sort | GET | 案件一覧 `{items,total,page,pageSize}` |
| /api/jobs/discover | POST `{limit?, platformKey?}` | 探索実行 |
| /api/jobs/import | POST `{rows?|csv?, platform?, analyze}` | 手動取込 |
| /api/jobs/[id] | GET | 案件詳細（analysis, opportunity, proposal, versions） |
| /api/jobs/[id]/analyze | POST | AI 解析 |
| /api/jobs/[id]/exclude | POST `{reason}` | 除外 |
| /api/jobs/[id]/proposal | POST `{length?, tone?, language?, variantLabel?, regenerate?}` | 提案生成/再生成 |
| /api/proposals?status&platformKey&page | GET | 提案一覧 |
| /api/proposals/[id] | GET / PATCH `{proposalTranslated, proposalOriginal?, changeReason?}` | 詳細 / 編集 |
| /api/proposals/[id]/approve, /reject `{reason}`, /mark-sent `{externalProposalId?}`, /send | POST | 承認 / 却下 / 手動送信済み / 再送 |
| /api/conversations?status&pending=1&page | GET | 会話一覧 |
| /api/conversations/sync | POST `{platformKey?}` | 返信取得 |
| /api/conversations/[id] | GET | Thread Context（job, analysis, proposal, quotes, latestQuote, pricingState, deal, messages[]） |
| /api/conversations/[id]/draft `{instruction?}` / negotiate / messages `{body, send}` | POST | AI返信案 / 交渉案 / 人間が送信 |
| /api/messages/[id]/approve `{body?}` / reject `{reason?}` | POST | 返信案の承認送信（編集可）/ 却下 |
| /api/opportunities | GET | Kanban 用一覧 |
| /api/opportunities/[id] | PATCH `{status}` | ステージ変更（WON 不可） |
| /api/opportunities/[id]/deal-summary / lost `{reason}` | POST | Deal Summary 生成 / 失注 |
| /api/deals, /api/deals/[id] | GET | 受注一覧 / 詳細 |
| /api/deals/[id]/approve | POST `{checklist?:[{key,confirmed,value?}], amount?, notes?}` | 人間承認 → WON |
| /api/crm/companies?q, /api/crm/companies/[id] (GET/PATCH) | | 企業 |
| /api/crm/contacts?clientId (GET/POST) | | 担当者 |
| /api/crm/tasks?status (GET), /api/crm/tasks/[id] (PATCH `{status}`) | | タスク |
| /api/automation/rules (GET/POST), /api/automation/rules/[id] (PATCH/DELETE), /api/automation/rules/dry-run (POST `{conditions}`), /api/automation/runs (GET) | | ルール |
| /api/analytics | GET | funnel, series(30d), breakdowns{platform,country,language,category}, ab{variants,openings,lengths,tones,ctas,pricePositions,portfolio,languages}, memory{notes,...} |
| /api/costs | GET | dailyCostUsd, monthlyCostUsd, totalCostUsd, costPerLead/Proposal/Reply/WonDeal, byAgent[], recent[], tokens |
| /api/audit?entityType&entityId&actorType&page | GET | 監査ログ |
| /api/settings (GET/PATCH `{appName?, name?, settings?}`) | | 組織設定（settings は `OrgSettings` 部分更新） |
| /api/settings/profile (GET/PUT) | | 会社プロフィール（`src/app/api/settings/profile/route.ts` の zod 参照） |
| /api/settings/platforms (GET/PATCH `{platformKey, label?, enabled?, sendMode?, credentials?, config?}`) | | プラットフォーム接続 |
| /api/settings/platforms/[key]/test (POST), /api/settings/platforms/[key]/limits (PUT `{dailyLimit,hourlyLimit,maxContactsPerClientPerWeek}`) | | 接続テスト / 制限 |
| /api/settings/prompts (GET/PUT `{agent, system, user, enabled, reset?}`) | | プロンプト |
| /api/settings/team (GET/POST `{email,name,password,role}`), /api/settings/team/[id] (PATCH `{role}` / DELETE) | | チーム |

サーバー側で直接呼べる services：`src/lib/services/{jobs,proposals,conversations,deals,crm,analytics,platforms,memory}.ts`、`src/lib/agents/thread.ts (buildThreadContext)`、`src/lib/settings.ts (getOrgSettings)`、`src/lib/agents/context.ts (getProfile)`、`src/lib/agents/prompts.ts`、`src/lib/automation/{conditions,actions}.ts (CONDITION_FIELDS, ACTION_LABELS)`、`src/lib/connectors/registry.ts`。

## 必須 data-testid

- Jobs: `jobs-table`, `job-row`, `job-analyze`, `job-create-proposal`, `job-exclude`, `analyze-all`, `job-detail-title`, `analysis-panel`, `proposal-panel`, `proposal-generate`, `proposal-approve`, `proposal-reject`, `proposal-text`, `proposal-original`, `proposal-edit`, `proposal-save`, `proposal-mark-sent`, `proposal-language`
- Proposals: `proposals-table`, `proposal-row`, `proposal-status-filter`
- Pipeline: `kanban`, `kanban-column-<STATUS>`, `kanban-card`
- Conversations: `conversations-list`, `conversation-row`, `thread`, `message-inbound`, `message-outbound`, `message-category`, `message-analysis`, `draft-reply`, `draft-negotiate`, `message-approve`, `message-reject`, `message-edit-body`, `compose-body`, `compose-send`, `create-deal-summary`, `pricing-state`, `sync-replies`
- Deals: `deals-table`, `deal-row`, `deal-checklist`, `deal-check-<key>`, `deal-approve`, `deal-status`
- CRM: `companies-table`, `company-row`, `contacts-table`, `tasks-table`, `task-done`
- Automation: `rules-table`, `rule-row`, `rule-new`, `rule-builder`, `rule-name`, `rule-trigger`, `rule-add-condition`, `rule-add-action`, `rule-save`, `rule-toggle`, `rule-dry-run`, `rule-delete`, `runs-table`
- Analytics: `analytics-funnel`, `analytics-breakdown-<platform|country|language|category>`, `analytics-ab`
- Costs: `costs-daily`, `costs-monthly`, `costs-by-agent`
- Audit: `audit-table`, `audit-row`
- Settings: `settings-tabs`, `settings-app-name`, `settings-save`, `profile-form`, `profile-company-name`, `profile-save`, `platform-card-<key>`, `platform-send-mode-<key>`, `platform-enabled-<key>`, `platform-test-<key>`, `platform-save-<key>`, `ai-provider`, `ai-model`, `ai-temperature`, `ai-automation-level`, `ai-auto-send`, `ai-min-price`, `ai-save`, `prompt-editor-<agent>`, `team-table`, `team-add`

## ページ別要件（要約）

### /jobs
フィルタ行（status / platform / category / country / q / minScore / sort）。テーブル：Score リング（opportunityScore）、Title(+client, country flag, language)、Category、Budget（`formatCurrency(dec(budgetMax), currency)` + USD）、Competitors、Rating、Posted(timeAgo)、Status、Proposal status、行アクション（Analyze / Create proposal / Exclude / View）。ヘッダーアクション：「Analyze all NEW」（NEW を順に /analyze 呼び出し、進捗トースト）、「Run discovery」、「Import (CSV/JSON dialog)」。ページネーション。

### /jobs/[id]
左：案件本文（raw description, skills, budget, deadline, client info, 外部リンク）。右：Analysis パネル（summary, client_goal, deliverables, difficulty, hours, market price, ScoreBar ×7, risk flags, recommended action, 再解析ボタン）。下：Proposal パネル（未生成なら length/tone/language 選択＋Generate；生成済みなら Tabs: Translated(クライアント言語) / Original(自社言語) / Structured(10セクション) / Compliance / Versions、編集モード、承認・却下・再生成・手動送信済み(MANUAL_ONLYの場合コピー用ボタン)・送信履歴）。会話があれば /conversations/[id] へのリンク。

### /proposals, /proposals/[id]
一覧（status フィルタ、pending を既定で上に）。詳細は /jobs/[id] の Proposal パネル相当 + 案件サマリ。

### /pipeline
12 ステータスの Kanban（横スクロール、列ヘッダに件数と合計 USD）。カード：title, client+flag, platform, score, value, last activity。カードのドロップダウンで「Move to …」（PATCH /api/opportunities/[id]）、「Mark lost」。WON は移動不可（Deal 承認で遷移）。

### /conversations, /conversations/[id]
一覧：client, job title, platform, status, last message preview, pending badge, last activity。`?pending=1` で承認待ちのみ。「Sync replies」ボタン。
詳細：3カラム（左：スレッド、右：サイドバー）。メッセージバブル（INBOUND 左・OUTBOUND 右、bodyTranslated があれば折りたたみで併記、INBOUND には category / sentiment / purchase_probability / urgency / next_best_action バッジ、OUTBOUND draft(PENDING) は編集可能 Textarea + Approve & Send / Reject）。下部：Compose（Textarea + Send）、ボタン：Generate AI reply / Negotiate (Pricing Engine) / Create Deal Summary（deal があれば /crm/deals/[id] へ）。サイドバー：job 概要、proposal 価格/納期、pricing state（current offer, discount applied, rounds, floor＝設定の minimumPrice は表示のみ）、quotes 一覧、lead status。

### /crm/companies, /crm/companies/[id], /crm/contacts, /crm/deals, /crm/deals/[id], /crm/tasks
企業：テーブル（name, country, language, rating, opportunities, won value）、詳細（編集フォーム、contacts 追加ダイアログ、opportunities 一覧）。
受注詳細：Deal Summary（narrative, 9項目チェックリスト＝各行 checkbox + value 入力）、金額、承認ボタン（全項目 confirmed 時のみ有効、確認ダイアログ）、承認後は WON バッジ＋approvedBy。
タスク：一覧 + Done ボタン。

### /automation
ルール一覧（name, trigger, conditions 数, actions, enabled Switch, runs 数, 編集/削除）。「New rule」で Rule Builder Dialog：name, description, trigger(select), priority, conditions 行（field select from CONDITION_FIELDS / op select / value input — type に応じ number/select/boolean）、actions 行（type select from ACTION_LABELS + params: CREATE_PROPOSAL→length/tone, SET_LEAD_STATUS→status, CREATE_TASK→title, EXCLUDE_JOB→reason）、「Dry run」（POST dry-run → matched/evaluated 表示）、保存。下部に Runs ログテーブル。

### /analytics
Funnel、30日トレンド、4 breakdown テーブル（jobs/proposals/replies/won/reply rate/win rate/revenue）、A/B テスト（variants / openings / lengths / tones / ctas / pricePositions / portfolio / languages を小テーブルで）、Performance Memory の notes。

### /costs
StatCard（daily, monthly, total, cost per lead/proposal/reply/won）、by agent テーブル、recent runs テーブル（agent, purpose, provider, model, tokens, cost, latency, success, time）。

### /audit
フィルタ（actorType, entityType, entityId）、テーブル（time, actor(type + user name/agent), action, entity, reason, before/after を展開表示）。

### /settings (layout with Tabs: General / Company Profile / Platforms / AI & Automation / Prompts / Team)
- General: appName（システム名変更）, org name, plan & limits 表示, defaultLanguage, businessHours, targetCountries/Categories/Languages (comma-separated input), excludeKeywords。
- Company Profile: 全フィールド（文字列配列は改行/カンマ区切り Textarea、achievements/portfolio/caseStudies/faq は行追加式のミニテーブル）。
- Platforms: 各プラットフォームカード（displayName, officialApi バッジ, automatedSendingPolicy バッジ, notes, enabled Switch, sendMode Select（PROHIBITED の場合 AUTO 選択不可）, credentialFields 入力（secret は password）, generic-api は config JSON Textarea, Test connection, Limits (daily/hourly/client) 入力＋保存, last discovery/poll 時刻）。
- AI & Automation: aiProvider(select: auto/anthropic/openai/mock + キー有無表示), aiModel, temperature(range), salesTone, defaultProposalLength, automationLevel, autoSendEnabled, requireHumanApprovalForWon/Price, minJobBudgetUsd, minOpportunityScore, aiDailyCostLimitUsd, aiMonthlyCostLimitUsd, pricing(minimumPrice/targetPrice/idealPrice/maximumDiscountPct/currency/hourlyRate), abTesting。
- Prompts: agent ごとに system/user Textarea + enabled + Save / Reset to default。
- Team: メンバー一覧（name, email, role select→PATCH, remove）、追加ダイアログ。
