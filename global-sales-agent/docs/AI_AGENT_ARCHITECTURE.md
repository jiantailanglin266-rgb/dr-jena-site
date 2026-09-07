# AI_AGENT_ARCHITECTURE.md

## 1. AI Provider Abstraction

```ts
interface AIProvider {
  readonly name: 'anthropic' | 'openai' | 'mock' | string;
  complete(req: AICompletionRequest): Promise<AICompletionResult>;
}
AICompletionRequest = { system, messages, model?, temperature?, maxTokens?, jsonMode?, agent, purpose }
AICompletionResult  = { text, model, usage: { inputTokens, outputTokens }, costUsd, latencyMs }
```

- `src/lib/ai/provider.ts`：`getAIProvider(orgSettings)` が組織設定（`aiProvider`, `aiModel`, `temperature`）と
  環境変数から provider を解決。キー未設定・`DEMO_MODE=true` の場合は `MockAIProvider`。
- `generateJSON(schema, req)`：JSON応答を Zod で検証、失敗時は修復プロンプトで1回リトライ。
- 全呼び出しは `ai_runs` に記録（tokens / costUsd / latency / agent / purpose）し、
  組織の `aiCostLimit`（日次）を超過した場合は `AICostLimitExceeded` を投げて処理停止。
- モデル料金表は `src/lib/ai/cost.ts`。将来 Gemini 等は `AIProvider` 実装追加＋登録のみ。

## 2. Agents

| Agent | 責務 | 入力 | 出力 |
|---|---|---|---|
| **Scout** | 案件探索。有効な PlatformAccount ごとにコネクタを呼び、正規化Jobを upsert | org, platform | 新規 Job[] |
| **Analyst** | 募集要項解析 → JSON（summary / client_goal / deliverables / skills / difficulty / hours / price / scores / risk_flags / recommended_action）+ Opportunity Score | Job + CompanyProfile | JobAnalysis |
| **Proposal** | 完全個別化提案（10構造）。SHORT/STANDARD/DETAILED × トーン。Performance Memory を参照 | Job, Analysis, Profile, Memory | Proposal draft |
| **Translation** | Client Language Detection と翻訳。`proposalOriginal` / `proposalTranslated` / `detectedLanguage` | text, targetLang | translated |
| **Compliance** | 規約・送信制限・重複・過剰接触・禁止条件・虚偽表現チェック | Proposal, PlatformAccount, Limits | allow / block + reasons |
| **Reply** | 返信解析（分類 / sentiment / intent / purchase_probability / urgency / next_best_action）と Thread Memory を用いた返信生成 | Conversation | analysis, draft |
| **Negotiation** | Pricing Engine の範囲内で交渉案（通常/割引/スコープ縮小/分割/オプション/保守） | Conversation, PricingConfig | offer + draft |
| **Closing** | Deal Summary（価格・納期・業務内容・成果物・修正回数・支払・IP・保守・契約方法）作成。未確定項目を列挙 | Conversation, Quote | DealSummary + checklist |
| **Supervisor** | オーケストレーション。イベントを受け取り、Automation Rule と組織設定に基づき次のAgentを起動 | event | AgentRun[] |

すべての Agent は `src/lib/agents/<name>.ts` に `run<Name>Agent(ctx, input)` として実装。
`ctx = { orgId, actor, provider, settings, profile }`。

## 3. Orchestration Layer

```
Event                          → Supervisor → Agent chain
JOB_DISCOVERED                 → Analyst → (score ≥ threshold ? QUALIFIED : EXCLUDED)
JOB_QUALIFIED (+rule)          → Proposal → Translation → Compliance → Queue
PROPOSAL_APPROVED              → Send Engine
REPLY_RECEIVED                 → Reply(analysis) → rule → Reply(draft) | Negotiation
REPLY_ACCEPTANCE / VERBAL_ACCEPT → Closing → Deal Summary → WAITING_HUMAN
DEAL_APPROVED (human)          → WON → CRM sync
```

- `src/lib/agents/orchestrator.ts` の `dispatch(event)` が単一入口。
- 自動化レベル（`automationLevel`: MANUAL / ASSISTED / SEMI_AUTO / FULL_AUTO）で
  どこまで人間承認なしに進むかを制御。ただし **契約成立 / 価格確定** は
  `requireHumanApprovalForWon` / `requireHumanApprovalForPrice` が true の限り必ず人間承認。

## 4. Thread Memory

`Conversation` を根に、job / analysis / proposal / quotes / messages(全件) / pricing state を
`buildThreadContext(conversationId)` で1つの構造にまとめ、Reply / Negotiation / Closing は
必ずこのコンテキストを受け取る（単発メッセージのみを見ない）。

## 5. Prompt Templates

- 既定プロンプトは `src/lib/agents/prompts/*.ts`。
- 組織は `prompt_templates` テーブルで agent ごとに上書き可能（管理画面 → AI設定）。
- 変数：`{{company}}`, `{{job}}`, `{{analysis}}`, `{{memory}}`, `{{thread}}`, `{{pricing}}` 等。

## 6. Performance Memory / A/B

- 提案送信時に特徴量（opening, length, pricePosition, ctaType, tone, hasPortfolio, language, platform, category, country, variant）を `performance_memory` に記録。
- 返信 / 受注時に結果を更新。
- Proposal Agent は `getMemoryInsights(orgId)`（特徴量別返信率上位）をプロンプトに注入する。
- A/B：`variantLabel`（A/B）をルール or 手動で割り当て、`analytics` で比較。

## 7. Mock Provider（Demo）

外部AIキーなしでも決定論的に：解析JSON、9言語提案、返信分類、交渉案、Deal Summary を生成。
案件テキスト・会社プロフィール・スレッド内容から動的に組み立てるため、案件ごとに内容が変わる。
